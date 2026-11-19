#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
集成脚本：连接我们的Spring Boot项目与final_submit_best中的WBF脚本
"""

import argparse
import json
import sys
import os
from pathlib import Path

# 添加final_submit_best/scripts到Python路径
scripts_dir = str(Path(__file__).parent / ".." / "models" / "result_max" / "result_max" / "final_submit_best" / "scripts")
sys.path.append(scripts_dir)

# 确保当前工作目录设置正确
os.chdir(str(Path(__file__).parent / ".."))

# 导入WBF脚本的功能
try:
    # 直接执行脚本而不是导入模块
    # 因为WBF脚本是设计为命令行执行的
    print(f"Scripts directory: {scripts_dir}")
    print(f"Current working directory: {os.getcwd()}")
except Exception as e:
    print(f"初始化失败: {e}")
    import traceback
    traceback.print_exc()

def parse_args():
    parser = argparse.ArgumentParser(description='集成WBF脚本')
    parser.add_argument('--action', type=str, required=True, choices=['evaluate', 'infer', 'infer-single', 'info'], help='执行动作')
    parser.add_argument('--rgb-dir', type=str, help='RGB图像目录')
    parser.add_argument('--ir-dir', type=str, help='红外图像目录')
    parser.add_argument('--rgb-path', type=str, help='单张RGB图像路径')
    parser.add_argument('--ir-path', type=str, help='单张红外图像路径')
    parser.add_argument('--label-dir', type=str, help='标签目录')
    parser.add_argument('--output', type=str, help='输出文件')
    parser.add_argument('--device', type=str, default='auto', help='设备选择')
    return parser.parse_args()

def evaluate(rgb_dir, ir_dir, label_dir, output, device):
    """
    执行WBF评估
    """
    try:
        # 构造命令
        cmd = [
            sys.executable,
            str(Path(scripts_dir) / "WBF_best_current.py"),
            "--rgb-dir", rgb_dir,
            "--ir-dir", ir_dir,
            "--label-dir", label_dir,
            "--output", output,
            "--device", device
        ]
        
        print(f"执行命令: {' '.join(cmd)}")
        
        # 执行命令
        import subprocess
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(Path(scripts_dir).parent))
        
        print(f"返回码: {result.returncode}")
        print(f"标准输出: {result.stdout}")
        print(f"标准错误: {result.stderr}")
        
        return result.returncode == 0
    except Exception as e:
        print(f"评估失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def infer(rgb_dir, ir_dir, output_dir, device, save_json=False, save_txt=False):
    """
    执行WBF推理
    """
    try:
        # 构造命令
        cmd = [
            sys.executable,
            str(Path(scripts_dir) / "WBF_best_current.py"),
            "--rgb-dir", rgb_dir,
            "--ir-dir", ir_dir,
            "--output", str(Path(output_dir) / "wbf_results.json"),
            "--device", device
        ]
        
        print(f"执行命令: {' '.join(cmd)}")
        
        # 执行命令
        import subprocess
        # 使用timeout限制执行时间，避免执行过慢
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(Path(scripts_dir).parent), timeout=60)
        
        print(f"返回码: {result.returncode}")
        print(f"标准输出: {result.stdout}")
        print(f"标准错误: {result.stderr}")
        
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print("推理超时，使用模拟结果")
        return False
    except Exception as e:
        print(f"推理失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def infer_single_image(rgb_path, ir_path, output_dir, device):
    """
    执行单张图片的WBF推理
    """
    try:
        # 构造命令
        # 为每个图片生成不同的结果文件名，避免覆盖
        image_name = Path(rgb_path).name
        result_file = f"wbf_single_result_{image_name.replace('.png', '')}.json"
        cmd = [
            sys.executable,
            str(Path(__file__).parent / "infer_single_wbf.py"),
            "--rgb-path", rgb_path,
            "--ir-path", ir_path,
            "--output", str(Path(output_dir) / result_file),
            "--device", device
        ]

        print("执行单张图片推理命令: " + " ".join(cmd))

        # 执行命令
        import subprocess
        # 使用timeout限制执行时间，避免执行过慢
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(Path(__file__).parent), timeout=30)

        print("返回码: " + str(result.returncode))
        print("标准输出: " + result.stdout)
        print("标准错误: " + result.stderr)

        # 读取结果
        result_path = Path(output_dir) / result_file
        if result_path.exists():
            with open(result_path, "r", encoding="utf-8") as f:
                result_data = json.load(f)
            # 不打印JSON，只返回结果
            return True, result_data

        return False, None
    except subprocess.TimeoutExpired:
        print("推理超时，使用模拟结果")
        return False, None
    except Exception as e:
        print("推理失败: " + str(e))
        import traceback
        traceback.print_exc()
        return False, None

def get_model_info():
    """
    获取模型信息
    """
    model_info = {
        "models": [
            {
                "name": "baseline_rgb_best.pt",
                "path": str(Path(scripts_dir).parent / "weights" / "baseline_rgb_best.pt"),
                "type": "baseline"
            },
            {
                "name": "baseline_ir_best.pt",
                "path": str(Path(scripts_dir).parent / "weights" / "baseline_ir_best.pt"),
                "type": "baseline"
            },
            {
                "name": "dual_6.0_best.pt",
                "path": str(Path(scripts_dir).parent / "weights" / "dual_6.0_best.pt"),
                "type": "dual"
            },
            {
                "name": "dual_l_best.pt",
                "path": str(Path(scripts_dir).parent / "weights" / "dual_l_best.pt"),
                "type": "dual"
            },
            {
                "name": "dual_l_50_best.pt",
                "path": str(Path(scripts_dir).parent / "weights" / "dual_l_50_best.pt"),
                "type": "dual"
            },
            {
                "name": "yolo26m.pt",
                "path": str(Path(scripts_dir).parent / "backbone" / "yolo26m.pt"),
                "type": "backbone"
            },
            {
                "name": "yolo26l.pt",
                "path": str(Path(scripts_dir).parent / "backbone" / "yolo26l.pt"),
                "type": "backbone"
            }
        ],
        "wbf_parameters": {
            "RGB": 1.70,
            "IR": 1.95,
            "dual_l": 1.20,
            "dual_6.0": 0.95,
            "dual_l_50": 1.00,
            "WBF_IOU_THR": 0.58,
            "WBF_SKIP_BOX_THR": 0.01,
            "FINAL_CONF": 0.10,
            "IMGSZ": 1024
        },
        "classes": ["car", "truck", "bus", "van", "freight_car"],
        "best_metrics": {
            "mAP50": 0.8360,
            "mAP50-95": 0.6054
        },
        "scripts_directory": scripts_dir,
        "current_working_directory": os.getcwd()
    }
    
    return model_info

def main():
    args = parse_args()
    
    if args.action == 'evaluate':
        success = evaluate(args.rgb_dir, args.ir_dir, args.label_dir, args.output, args.device)
        print(json.dumps({"status": "success" if success else "error"}))
    elif args.action == 'infer':
        success = infer(args.rgb_dir, args.ir_dir, args.output, args.device, True, True)
        print(json.dumps({"status": "success" if success else "error"}))
    elif args.action == 'infer-single':
        success, result = infer_single_image(args.rgb_path, args.ir_path, args.output, args.device)
        if success and result:
            print(json.dumps(result))
        else:
            print(json.dumps({"status": "error"}))
    elif args.action == 'info':
        info = get_model_info()
        print(json.dumps(info, indent=2))
    else:
        print(json.dumps({"status": "error", "message": "无效的动作"}))

if __name__ == '__main__':
    main()
