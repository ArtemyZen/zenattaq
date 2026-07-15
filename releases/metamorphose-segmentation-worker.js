let imageSegmenter = null;

const reportError = (error) => {
  self.postMessage({
    type: "ERROR",
    message: error?.message || String(error),
  });
};

const initialize = async () => {
  if (imageSegmenter) {
    self.postMessage({ type: "READY" });
    return;
  }

  try {
    const visionTasks = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm");
    const vision = await visionTasks.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    );
    imageSegmenter = await visionTasks.ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
    self.postMessage({ type: "READY" });
  } catch (error) {
    reportError(error);
  }
};

const processFrame = ({ bitmap, timestamp }) => {
  if (!imageSegmenter) {
    bitmap?.close();
    reportError(new Error("Body segmenter is not ready."));
    return;
  }

  try {
    imageSegmenter.segmentForVideo(bitmap, timestamp, (result) => {
      try {
        if (!result.categoryMask) {
          reportError(new Error("Segmentation mask was not returned."));
          return;
        }
        const source = result.categoryMask.getAsUint8Array();
        const categoryData = new Uint8Array(source);
        const width = result.categoryMask.width;
        const height = result.categoryMask.height;
        self.postMessage({ type: "MASK", buffer: categoryData.buffer, width, height }, [categoryData.buffer]);
      } catch (error) {
        reportError(error);
      } finally {
        result.categoryMask?.close();
        result.confidenceMasks?.forEach((mask) => mask.close());
        bitmap.close();
      }
    });
  } catch (error) {
    bitmap.close();
    reportError(error);
  }
};

self.addEventListener("message", ({ data }) => {
  if (data.type === "INIT") initialize();
  if (data.type === "FRAME") processFrame(data);
  if (data.type === "CLOSE") {
    imageSegmenter?.close?.();
    self.close();
  }
});
