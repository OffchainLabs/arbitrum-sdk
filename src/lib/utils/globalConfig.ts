export const globalConfig = {
  experimentalFeaturesEnabled: false,
}

export const enableExperimentalFeatures = () => {
  globalConfig.experimentalFeaturesEnabled = true
}

export const experimentalFeaturesEnabled = () => {
  return globalConfig.experimentalFeaturesEnabled
}
