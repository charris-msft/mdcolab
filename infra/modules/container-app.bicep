param name string
param location string = resourceGroup().location
param tags object = {}
param containerAppsEnvironmentId string
param containerRegistryName string
param identityId string
param identityClientId string
param env array = []
param secrets array = []
param targetPort int = 3000
param cpu string = '0.5'
param memory string = '1Gi'
param minReplicas int = 0
param maxReplicas int = 3

@description('Whether the container app already exists. When true, the currently running image is preserved instead of being reset to the placeholder image (so azd provision never clobbers a live deployment).')
param exists bool = false

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: containerRegistryName
}

resource existingApp 'Microsoft.App/containerApps@2024-03-01' existing = if (exists) {
  name: name
}

var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var image = exists ? existingApp.properties.template.containers[0].image : placeholderImage

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: identityId
        }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          image: image
          name: 'web'
          env: env
          resources: {
            cpu: json(cpu)
            memory: memory
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output uri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output name string = containerApp.name
output id string = containerApp.id
