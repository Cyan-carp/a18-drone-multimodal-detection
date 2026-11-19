<template>
  <div class="app">
    <h1>交通目标检测系统</h1>

    <div class="upload-section">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card class="upload-card">
            <template #header>
              <div class="card-header">
                <span>RGB 图片上传</span>
              </div>
            </template>
            <el-upload
              class="upload-demo"
              drag
              :action="uploadUrl"
              :on-success="handleRgbUploadSuccess"
              :on-error="handleUploadError"
              :before-upload="beforeUpload"
              accept="image/*"
              name="file"
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                拖拽图片到此处或 <em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">支持 JPG/PNG 格式</div>
              </template>
            </el-upload>
            <div v-if="rgbImage" class="preview-container">
              <div class="image-wrapper">
                <img :src="rgbImage" alt="RGB" class="preview-image" ref="rgbImgRef" @load="onRgbImageLoad" />
                <canvas ref="rgbCanvasRef" class="preview-canvas"></canvas>
              </div>
              <div class="detection-info" v-if="rgbDetections.length > 0">
                <span>检测到 {{ rgbDetections.length }} 个目标</span>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="12">
          <el-card class="upload-card">
            <template #header>
              <div class="card-header">
                <span>IR 图片上传</span>
              </div>
            </template>
            <el-upload
              class="upload-demo"
              drag
              :action="uploadUrl"
              :on-success="handleIrUploadSuccess"
              :on-error="handleUploadError"
              :before-upload="beforeUpload"
              accept="image/*"
              name="file"
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                拖拽图片到此处或 <em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">支持 JPG/PNG 格式</div>
              </template>
            </el-upload>
            <div v-if="irImage" class="preview-container">
              <div class="image-wrapper">
                <img :src="irImage" alt="IR" class="preview-image" ref="irImgRef" @load="onIrImageLoad" />
                <canvas ref="irCanvasRef" class="preview-canvas"></canvas>
              </div>
              <div class="detection-info" v-if="irDetections.length > 0">
                <span>检测到 {{ irDetections.length }} 个目标</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <div class="action-section">
        <el-button type="primary" size="large" @click="startDetection" :loading="loading" :disabled="!canDetect">
          {{ loading ? '检测中...' : '开始检测' }}
        </el-button>
      </div>
    </div>

    <div v-if="rgbDetections.length > 0 || irDetections.length > 0" class="result-section">
      <el-card class="result-card">
        <template #header>
          <div class="card-header">
            <span>检测详情</span>
          </div>
        </template>
        <el-row :gutter="20">
          <el-col :span="12" v-if="rgbDetections.length > 0">
            <h3>RGB 检测结果 ({{ rgbDetections.length }} 个目标)</h3>
            <el-scrollbar height="250px">
              <div v-for="(detection, index) in rgbDetections" :key="'rgb-' + index" class="detection-item">
                <el-tag :type="getTagType(detection.class)" size="small">{{ detection.class }}</el-tag>
                <span class="confidence">置信度: {{ (detection.confidence * 100).toFixed(2) }}%</span>
              </div>
            </el-scrollbar>
          </el-col>
          <el-col :span="12" v-if="irDetections.length > 0">
            <h3>IR 检测结果 ({{ irDetections.length }} 个目标)</h3>
            <el-scrollbar height="250px">
              <div v-for="(detection, index) in irDetections" :key="'ir-' + index" class="detection-item">
                <el-tag :type="getTagType(detection.class)" size="small">{{ detection.class }}</el-tag>
                <span class="confidence">置信度: {{ (detection.confidence * 100).toFixed(2) }}%</span>
              </div>
            </el-scrollbar>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </div>
</template>

<script>
import { UploadFilled } from '@element-plus/icons-vue'

export default {
  name: 'App',
  components: {
    UploadFilled
  },
  data() {
    return {
      uploadUrl: 'http://localhost:8080/api/detection/upload',
      rgbImage: '',
      irImage: '',
      rgbFileName: '',
      irFileName: '',
      rgbDetections: [],
      irDetections: [],
      loading: false
    }
  },
  computed: {
    canDetect() {
      return this.rgbImage || this.irImage
    }
  },
  methods: {
    handleRgbUploadSuccess(response, file) {
      if (response.status === 'success') {
        this.rgbImage = `http://localhost:8080/api/detection/image?type=rgb&name=${response.fileName}`
        this.rgbFileName = response.fileName
        this.rgbDetections = []
        this.$message.success('RGB图片上传成功')
      } else {
        this.$message.error('上传失败: ' + response.message)
      }
    },
    handleIrUploadSuccess(response, file) {
      if (response.status === 'success') {
        this.irImage = `http://localhost:8080/api/detection/image?type=ir&name=${response.fileName}`
        this.irFileName = response.fileName
        this.irDetections = []
        this.$message.success('IR图片上传成功')
      } else {
        this.$message.error('上传失败: ' + response.message)
      }
    },
    handleUploadError(err) {
      this.$message.error('上传失败，请检查网络连接')
      console.error(err)
    },
    beforeUpload(file) {
      const isImage = file.type.startsWith('image/')
      const isLt10M = file.size / 1024 / 1024 < 10
      if (!isImage) {
        this.$message.error('只能上传图片文件')
        return false
      }
      if (!isLt10M) {
        this.$message.error('图片大小不能超过 10MB')
        return false
      }
      return true
    },
    async startDetection() {
      if (!this.rgbImage && !this.irImage) {
        this.$message.warning('请先上传至少一张图片')
        return
      }

      this.loading = true

      try {
        if (this.rgbImage && this.rgbFileName) {
          await this.detectImage('rgb', this.rgbFileName)
        }
        if (this.irImage && this.irFileName) {
          await this.detectImage('ir', this.irFileName)
        }
        this.$message.success('检测完成')
      } catch (err) {
        this.$message.error('检测请求失败')
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    async detectImage(type, imageName) {
      try {
        const response = await fetch(`http://localhost:8080/api/detection/detect?type=${type}&image=${imageName}`)
        const data = await response.json()

        if (data.status === 'success') {
          const detections = data.detections || []
          if (type === 'rgb') {
            this.rgbDetections = detections
            this.$nextTick(() => {
              this.drawBoundingBoxes('rgb')
            })
          } else {
            this.irDetections = detections
            this.$nextTick(() => {
              this.drawBoundingBoxes('ir')
            })
          }
        } else {
          this.$message.error('检测 ' + type + ' 图片失败: ' + (data.message || '未知错误'))
        }
      } catch (err) {
        this.$message.error('检测请求失败')
        console.error(err)
      }
    },
    onRgbImageLoad() {
      this.drawBoundingBoxes('rgb')
    },
    onIrImageLoad() {
      this.drawBoundingBoxes('ir')
    },
    drawBoundingBoxes(type) {
      const canvas = type === 'rgb' ? this.$refs.rgbCanvasRef : this.$refs.irCanvasRef
      const img = type === 'rgb' ? this.$refs.rgbImgRef : this.$refs.irImgRef
      const detections = type === 'rgb' ? this.rgbDetections : this.irDetections

      if (!canvas || !img || !detections || detections.length === 0) {
        return
      }

      const displayedWidth = img.clientWidth
      const displayedHeight = img.clientHeight
      const originalWidth = img.naturalWidth
      const originalHeight = img.naturalHeight

      if (originalWidth === 0 || originalHeight === 0) {
        return
      }

      const scaleX = displayedWidth / originalWidth
      const scaleY = displayedHeight / originalHeight

      canvas.width = displayedWidth
      canvas.height = displayedHeight
      canvas.style.width = displayedWidth + 'px'
      canvas.style.height = displayedHeight + 'px'

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const classColors = {
        'car': '#00FF00',
        'truck': '#FF00FF',
        'bus': '#00FFFF',
        'van': '#FFFF00',
        'freight_car': '#FF00FF'
      }

      detections.forEach(detection => {
        const box = detection.box
        const confidence = detection.confidence
        const className = detection.class

        const x1 = box[0] * scaleX
        const y1 = box[1] * scaleY
        const x2 = box[2] * scaleX
        const y2 = box[3] * scaleY

        const color = classColors[className] || '#FF0000'

        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

        ctx.fillStyle = color
        ctx.font = 'bold 14px Arial'
        const label = `${className}:${confidence.toFixed(2)}`
        ctx.fillText(label, x1, y1 - 5)
      })
    },
    getTagType(className) {
      const types = {
        'car': 'success',
        'truck': 'warning',
        'bus': 'info',
        'van': 'danger',
        'freight_car': 'warning'
      }
      return types[className] || ''
    }
  }
}
</script>

<style scoped>
.app {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.upload-section {
  margin-bottom: 30px;
}

.upload-card {
  height: 100%;
}

.card-header {
  font-weight: bold;
}

.preview-container {
  margin-top: 15px;
  text-align: center;
}

.image-wrapper {
  position: relative;
  display: inline-block;
}

.preview-image {
  max-width: 100%;
  max-height: 350px;
  border-radius: 8px;
}

.preview-canvas {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 8px;
  pointer-events: none;
}

.detection-info {
  margin-top: 10px;
  color: #67c23a;
  font-size: 14px;
}

.action-section {
  text-align: center;
  margin-top: 20px;
}

.result-section {
  margin-top: 20px;
}

.result-card {
  width: 100%;
}

.result-card h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.detection-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.confidence {
  color: #666;
  font-size: 14px;
}

:deep(.el-upload-dragger) {
  padding: 20px;
}
</style>
