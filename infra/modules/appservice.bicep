param name string
param location string = resourceGroup().location
param tags object = {}
param appServicePlanId string
param runtimeName string = 'node'
param runtimeVersion string = '20-lts'
param appSettings array = []
param applicationInsightsName string = ''

param alwaysOn bool = true

resource appService 'Microsoft.Web/sites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlanId
    siteConfig: {
      linuxFxVersion: '${runtimeName}|${runtimeVersion}'
      alwaysOn: alwaysOn
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appCommandLine: 'node server.js'
      appSettings: concat(appSettings, [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
      ])
    }
    httpsOnly: true
  }
}

output uri string = 'https://${appService.properties.defaultHostName}'
output name string = appService.name
output id string = appService.id
