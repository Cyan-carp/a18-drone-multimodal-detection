#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单张图片WBF推理脚本
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO

try:
    from ensemble_boxes import weighted_boxes_fusion as eb_weighted_boxes_fusion
except Exception:
    eb_weighted_boxes_fusion = None

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "models" / "result_max" / "result_max" / "final_submit_best"
WEIGHTS_DIR = PACKAGE_ROOT / "weights"
BACKBONE_DIR = PACKAGE_ROOT / "backbone"
MODEL_DEFS_DIR = PACKAGE_ROOT / "model_defs"

RGB_WEIGHTS = WEIGHTS_DIR / "baseline_rgb_best.pt"
IR_WEIGHTS = WEIGHTS_DIR / "baseline_ir_best.pt"

DUAL_MODELS = [
    {
        "name": "dual_l",
        "weights": WEIGHTS_DIR / "dual_l_best.pt",
        "backbone": BACKBONE_DIR / "yolo26l.pt",
        "wbf_weight": 1.20,
        "enabled": True,
    },
    {
        "name": "dual_6_0",
        "weights": WEIGHTS_DIR / "dual_6.0_best.pt",
        "backbone": BACKBONE_DIR / "yolo26m.pt",
        "wbf_weight": 0.95,
        "enabled": True,
    },
    {
        "name": "dual_l_50",
        "weights": WEIGHTS_DIR / "dual_l_50_best.pt",
        "backbone": BACKBONE_DIR / "yolo26l.pt",
        "wbf_weight": 1.00,
        "enabled": True,
    },
]

CLASSES = ["car", "truck", "bus", "van", "freight_car"]
NUM_CLASSES = len(CLASSES)

RGB_WBF_WEIGHT = 1.70
IR_WBF_WEIGHT = 1.95
WBF_IOU_THR = 0.58
WBF_SKIP_BOX_THR = 0.01
FINAL_CONF = 0.10

def resolve_device(device_arg):
    if device_arg == "auto":
        return ("cuda", 0) if torch.cuda.is_available() else ("cpu", "cpu")
    if device_arg in {"cpu", "cuda"}:
        return (device_arg, 0 if device_arg == "cuda" else "cpu")
    if device_arg.isdigit():
        return ("cuda" if torch.cuda.is_available() else "cpu", int(device_arg) if torch.cuda.is_available() else "cpu")
    return (device_arg, device_arg)

def pixel_xyxy_to_normalized_xyxy(pred, orig_w, orig_h):
    pred = np.asarray(pred, dtype=np.float32)
    if pred.size == 0:
        return [], [], []
    boxes = pred[:, :4].copy()
    scores = pred[:, 4].copy()
    labels = pred[:, 5].astype(int).copy()
    boxes[:, 0] = np.clip(boxes[:, 0], 0, orig_w)
    boxes[:, 2] = np.clip(boxes[:, 2], 0, orig_w)
    boxes[:, 1] = np.clip(boxes[:, 1], 0, orig_h)
    boxes[:, 3] = np.clip(boxes[:, 3], 0, orig_h)
    keep = (boxes[:, 2] > boxes[:, 0]) & (boxes[:, 3] > boxes[:, 1])
    boxes = boxes[keep]
    scores = scores[keep]
    labels = labels[keep]
    if len(boxes) == 0:
        return [], [], []
    boxes[:, [0, 2]] /= float(orig_w)
    boxes[:, [1, 3]] /= float(orig_h)
    boxes = np.clip(boxes, 0.0, 1.0)
    return boxes.tolist(), scores.tolist(), labels.tolist()

def normalized_xyxy_to_pixel_xyxy(boxes, scores, labels, orig_w, orig_h):
    if len(boxes) == 0:
        return np.zeros((0, 6), dtype=np.float32)
    boxes = np.asarray(boxes, dtype=np.float32)
    scores = np.asarray(scores, dtype=np.float32).reshape(-1, 1)
    labels = np.asarray(labels, dtype=np.float32).reshape(-1, 1)
    boxes[:, [0, 2]] *= float(orig_w)
    boxes[:, [1, 3]] *= float(orig_h)
    return np.concatenate([boxes, scores, labels], axis=1)

def compute_iou(box, boxes):
    if len(boxes) == 0:
        return np.zeros((0,), dtype=np.float32)
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])
    inter = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
    area_box = np.maximum(0, box[2] - box[0]) * np.maximum(0, box[3] - box[1])
    area_boxes = np.maximum(0, boxes[:, 2] - boxes[:, 0]) * np.maximum(0, boxes[:, 3] - boxes[:, 1])
    return inter / (area_box + area_boxes - inter + 1e-7)

def weighted_boxes_fusion_local(boxes_list, scores_list, labels_list, weights, iou_thr, skip_box_thr):
    candidates = {}
    for model_idx, (boxes, scores, labels, model_weight) in enumerate(zip(boxes_list, scores_list, labels_list, weights)):
        for box, score, label in zip(boxes, scores, labels):
            if score < skip_box_thr:
                continue
            label = int(label)
            candidates.setdefault(label, []).append(
                {
                    "box": np.asarray(box, dtype=np.float32),
                    "score": float(score),
                    "model_idx": model_idx,
                    "model_weight": float(model_weight),
                }
            )

    fused_boxes = []
    fused_scores = []
    fused_labels = []

    for label, items in candidates.items():
        items = sorted(items, key=lambda x: x["score"] * x["model_weight"], reverse=True)
        clusters = []
        reps = []

        for item in items:
            if not reps:
                clusters.append([item])
                reps.append(item["box"].copy())
                continue

            rep_arr = np.asarray(reps, dtype=np.float32)
            ious = compute_iou(item["box"], rep_arr)
            best_idx = int(np.argmax(ious))

            if ious[best_idx] >= iou_thr:
                clusters[best_idx].append(item)
                ws = np.asarray([x["score"] * x["model_weight"] for x in clusters[best_idx]], dtype=np.float32)
                bs = np.asarray([x["box"] for x in clusters[best_idx]], dtype=np.float32)
                reps[best_idx] = (bs * ws[:, None]).sum(axis=0) / max(ws.sum(), 1e-7)
            else:
                clusters.append([item])
                reps.append(item["box"].copy())

        for cluster, rep in zip(clusters, reps):
            unique_weights = {}
            score_weight_sum = 0.0
            for entry in cluster:
                unique_weights[entry["model_idx"]] = entry["model_weight"]
                score_weight_sum += entry["score"] * entry["model_weight"]
            denom = max(sum(unique_weights.values()), 1e-7)
            fused_score = score_weight_sum / denom
            fused_boxes.append(rep.tolist())
            fused_scores.append(float(fused_score))
            fused_labels.append(label)

    if fused_scores:
        order = np.argsort(-np.asarray(fused_scores))
        fused_boxes = [fused_boxes[i] for i in order]
        fused_scores = [fused_scores[i] for i in order]
        fused_labels = [fused_labels[i] for i in order]

    return fused_boxes, fused_scores, fused_labels

def weighted_boxes_fusion_safe(boxes_list, scores_list, labels_list, weights, iou_thr, skip_box_thr):
    if eb_weighted_boxes_fusion is not None:
        return eb_weighted_boxes_fusion(
            boxes_list,
            scores_list,
            labels_list,
            weights=weights,
            iou_thr=iou_thr,
            skip_box_thr=skip_box_thr,
        )
    return weighted_boxes_fusion_local(boxes_list, scores_list, labels_list, weights, iou_thr, skip_box_thr)

def predict_ultralytics(model, img_path, imgsz, conf, iou, predict_device):
    img = cv2.imread(str(img_path))
    orig_h, orig_w = img.shape[:2]
    results = model.predict(
        source=str(img_path),
        imgsz=imgsz,
        conf=conf,
        iou=iou,
        device=predict_device,
        verbose=False,
    )
    r = results[0]
    if r.boxes is None or len(r.boxes) == 0:
        pred = np.zeros((0, 6), dtype=np.float32)
    else:
        xyxy = r.boxes.xyxy.detach().cpu().numpy()
        confs = r.boxes.conf.detach().cpu().numpy().reshape(-1, 1)
        clses = r.boxes.cls.detach().cpu().numpy().reshape(-1, 1)
        pred = np.concatenate([xyxy, confs, clses], axis=1)
    return pred, orig_h, orig_w

def predict_dual(model, rgb_path, ir_path, imgsz, conf, device):
    rgb = cv2.imread(str(rgb_path))
    rgb = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)

    ir = cv2.imread(str(ir_path))
    if ir is None:
        raise RuntimeError("IR image not found: " + str(ir_path))
    if len(ir.shape) == 2:
        ir = np.stack([ir, ir, ir], axis=-1)
    else:
        ir = cv2.cvtColor(ir, cv2.COLOR_BGR2RGB)

    orig_h, orig_w = rgb.shape[:2]

    def letterbox(img, size):
        h, w = img.shape[:2]
        r = size / max(h, w)
        new_w, new_h = int(w * r), int(h * r)
        img = cv2.resize(img, (new_w, new_h))
        dh, dw = size - new_h, size - new_w
        top, left = dh // 2, dw // 2
        img = cv2.copyMakeBorder(img, top, dh - top, left, dw - left, cv2.BORDER_CONSTANT, value=(114, 114, 114))
        return img, r, left, top

    rgb_lb, r, left, top = letterbox(rgb, imgsz)
    ir_lb, _, _, _ = letterbox(ir, imgsz)

    rgb_t = torch.from_numpy(rgb_lb.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0
    ir_t = torch.from_numpy(ir_lb.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0
    rgb_t = rgb_t.to(device)
    ir_t = ir_t.to(device)

    output = model(rgb_t, ir_t)
    preds = output[0] if isinstance(output, (list, tuple)) else output
    preds = preds[0].detach().cpu().numpy()
    preds = preds[preds[:, 4] > conf]

    dual_raw = preds[:, :6].copy()
    if len(dual_raw) > 0:
        dual_orig = dual_raw.copy()
        dual_orig[:, [0, 2]] = (dual_orig[:, [0, 2]] - left) / r
        dual_orig[:, [1, 3]] = (dual_orig[:, [1, 3]] - top) / r
        dual_orig[:, [0, 2]] = np.clip(dual_orig[:, [0, 2]], 0, orig_w)
        dual_orig[:, [1, 3]] = np.clip(dual_orig[:, [1, 3]], 0, orig_h)
    else:
        dual_orig = dual_raw
    return dual_orig, orig_h, orig_w

def main():
    parser = argparse.ArgumentParser(description="Single image WBF inference")
    parser.add_argument("--rgb-path", required=True, help="RGB image path")
    parser.add_argument("--ir-path", required=True, help="IR image path")
    parser.add_argument("--output", required=True, help="Output JSON file")
    parser.add_argument("--device", default="auto", help="auto/cpu/cuda/0")
    parser.add_argument("--imgsz", type=int, default=1024, help="Inference image size")
    parser.add_argument("--conf", type=float, default=0.05, help="Per-branch confidence threshold")
    parser.add_argument("--iou", type=float, default=0.7, help="Per-branch NMS IoU threshold")
    args = parser.parse_args()

    runtime_device, predict_device = resolve_device(args.device)

    sys.path.insert(0, str(PACKAGE_ROOT))
    from model_defs.maf_yolo26 import MAFYOLO26

    rgb_path = Path(args.rgb_path)
    ir_path = Path(args.ir_path)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 90)
    print("SINGLE IMAGE WBF INFERENCE")
    print("=" * 90)
    print("rgb_path:  " + str(rgb_path))
    print("ir_path:   " + str(ir_path))
    print("output:    " + str(output_path))
    print("device:    " + str(runtime_device))
    print("imgsz:     " + str(args.imgsz))
    print("conf:      " + str(args.conf))
    print("iou:       " + str(args.iou))
    print("final_conf:" + str(FINAL_CONF))
    print("wbf_iou:   " + str(WBF_IOU_THR))

    for required in [RGB_WEIGHTS, IR_WEIGHTS] + [cfg["weights"] for cfg in DUAL_MODELS] + [cfg["backbone"] for cfg in DUAL_MODELS]:
        if not Path(required).exists():
            raise FileNotFoundError("Missing required file: " + str(required))

    rgb_model = YOLO(str(RGB_WEIGHTS))
    ir_model = YOLO(str(IR_WEIGHTS))

    dual_models = []
    for cfg in DUAL_MODELS:
        if not cfg.get("enabled", True):
            continue
        model = MAFYOLO26(model_name=str(cfg["backbone"]), nc=5).to(runtime_device)
        state = torch.load(cfg["weights"], map_location=runtime_device)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state, strict=False)
        model.eval()
        dual_models.append((cfg, model))

    boxes_list = []
    scores_list = []
    labels_list = []
    fusion_weights = []

    rgb_pred, orig_h, orig_w = predict_ultralytics(rgb_model, rgb_path, args.imgsz, args.conf, args.iou, predict_device)
    rgb_boxes, rgb_scores, rgb_labels = pixel_xyxy_to_normalized_xyxy(rgb_pred, orig_w, orig_h)
    boxes_list.append(rgb_boxes)
    scores_list.append(rgb_scores)
    labels_list.append(rgb_labels)
    fusion_weights.append(RGB_WBF_WEIGHT)

    ir_pred, _, _ = predict_ultralytics(ir_model, ir_path, args.imgsz, args.conf, args.iou, predict_device)
    ir_boxes, ir_scores, ir_labels = pixel_xyxy_to_normalized_xyxy(ir_pred, orig_w, orig_h)
    boxes_list.append(ir_boxes)
    scores_list.append(ir_scores)
    labels_list.append(ir_labels)
    fusion_weights.append(IR_WBF_WEIGHT)

    for cfg, dual_model in dual_models:
        dual_pred, _, _ = predict_dual(dual_model, rgb_path, ir_path, args.imgsz, args.conf, runtime_device)
        dual_boxes, dual_scores, dual_labels = pixel_xyxy_to_normalized_xyxy(dual_pred, orig_w, orig_h)
        boxes_list.append(dual_boxes)
        scores_list.append(dual_scores)
        labels_list.append(dual_labels)
        fusion_weights.append(cfg["wbf_weight"])

    fused_boxes, fused_scores, fused_labels = weighted_boxes_fusion_safe(
        boxes_list,
        scores_list,
        labels_list,
        weights=fusion_weights,
        iou_thr=WBF_IOU_THR,
        skip_box_thr=WBF_SKIP_BOX_THR,
    )

    fused_pred = normalized_xyxy_to_pixel_xyxy(fused_boxes, fused_scores, fused_labels, orig_w, orig_h)
    if len(fused_pred) > 0:
        fused_pred = fused_pred[fused_pred[:, 4] >= FINAL_CONF]

    detections = []
    for pred in fused_pred:
        x1, y1, x2, y2, conf, cls_id = pred
        detections.append({
            "class": CLASSES[int(cls_id)],
            "confidence": float(conf),
            "box": [int(x1), int(y1), int(x2), int(y2)]
        })

    result = {
        "status": "success",
        "image": str(rgb_path.name),
        "detections": detections,
        "orig_width": orig_w,
        "orig_height": orig_h
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # 只打印摘要信息，不打印JSON
    print("")
    print("Inference completed for " + str(rgb_path.name))
    print("Found " + str(len(detections)) + " objects")
    print("Saved results to: " + str(output_path))

if __name__ == "__main__":
    main()
