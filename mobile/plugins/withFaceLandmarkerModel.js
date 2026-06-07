const fs = require("fs");
const path = require("path");
const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
} = require("@expo/config-plugins");

const MODEL_FILE = "face_landmarker.task";
const MODEL_REL = `assets/models/${MODEL_FILE}`;

function assertModelPresent(projectRoot) {
  const src = path.join(projectRoot, MODEL_REL);
  if (!fs.existsSync(src)) {
    throw new Error(
      `[withFaceLandmarkerModel] Missing ${MODEL_REL}. Run: cd mobile && npm run mediapipe:download-model`
    );
  }
  return src;
}

const IOS_BLENDSHAPE_PATCH =
  "faceLandmarkerOptions.outputFaceBlendshapes = true";

/** Enable blendshape output on iOS (Android already sets this). */
function patchIosFaceLandmarkBlendshapes(projectRoot) {
  const helperPath = path.join(
    projectRoot,
    "node_modules/react-native-mediapipe/ios/facelandmarkdetection/FaceLandmarkDetectorHelper.swift"
  );
  if (!fs.existsSync(helperPath)) return;
  let src = fs.readFileSync(helperPath, "utf8");
  if (src.includes(IOS_BLENDSHAPE_PATCH)) return;
  const needle = "faceLandmarkerOptions.baseOptions.delegate = self.optionsDelegate";
  if (!src.includes(needle)) {
    console.warn(
      "[withFaceLandmarkerModel] Could not patch iOS blendshapes — FaceLandmarkDetectorHelper.swift changed"
    );
    return;
  }
  src = src.replace(
    needle,
    `${IOS_BLENDSHAPE_PATCH}\n    ${needle}`
  );
  fs.writeFileSync(helperPath, src);
}

/** Copy MediaPipe face landmarker model into native Android/iOS bundles on prebuild. */
function withFaceLandmarkerModel(config) {
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      patchIosFaceLandmarkBlendshapes(cfg.modRequest.projectRoot);
      const root = cfg.modRequest.projectRoot;
      const src = assertModelPresent(root);
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const dest = path.join(cfg.modRequest.platformProjectRoot, projectName, MODEL_FILE);
      fs.copyFileSync(src, dest);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const src = assertModelPresent(root);
      const destDir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/assets");
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, MODEL_FILE));
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filePath = `${projectName}/${MODEL_FILE}`;
    if (!cfg.modResults.hasFile(filePath)) {
      cfg.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project: cfg.modResults,
        isBuildFile: true,
        verbose: true,
      });
    }
    return cfg;
  });

  return config;
}

module.exports = withFaceLandmarkerModel;
