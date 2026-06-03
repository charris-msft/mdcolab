targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (used for resource naming)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Principal ID of the deploying user')
param principalId string = ''

@secure()
@description('GitHub OAuth Client ID')
param githubClientId string = ''

@secure()
@description('GitHub OAuth Client Secret')
param githubClientSecret string = ''

@secure()
@description('NextAuth.js secret for JWT signing')
param nextauthSecret string = ''

@description('NextAuth.js URL')
param nextauthUrl string = ''

@description('Name of the web container app (the real production app consolidated under azd)')
param webContainerAppName string = 'ca-web-ai-preview'

@description('Whether the web container app already exists; preserves the running image on provision')
param webExists bool = false

@description('Node environment')
param nodeEnv string = 'production'

@description('GitHub App ID (non-secret)')
param githubAppId string = ''

@secure()
@minLength(1)
@description('GitHub App private key. Required: provision fails loudly if unset so it can never wipe the live secret.')
param githubAppPrivateKey string

@secure()
@minLength(1)
@description('Test password secret. Required: provision fails loudly if unset so it can never wipe the live secret.')
param testPw string

var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    tags: tags
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
  }
}

module containerRegistry 'modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
  }
}

module containerAppsEnvironment 'modules/container-apps-environment.bicep' = {
  name: 'container-apps-environment'
  scope: rg
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

module identity 'modules/identity.bicep' = {
  name: 'identity'
  scope: rg
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}${resourceToken}'
    location: location
    tags: tags
    containerRegistryName: containerRegistry.outputs.name
  }
}

module web 'modules/container-app.bicep' = {
  name: 'web'
  scope: rg
  params: {
    name: webContainerAppName
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.id
    containerRegistryName: containerRegistry.outputs.name
    identityId: identity.outputs.id
    identityClientId: identity.outputs.clientId
    exists: webExists
    cpu: '1.0'
    memory: '2Gi'
    minReplicas: 1
    maxReplicas: 3
    env: [
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: monitoring.outputs.applicationInsightsConnectionString
      }
      {
        name: 'NEXTAUTH_URL'
        value: nextauthUrl
      }
      {
        name: 'NEXTAUTH_SECRET'
        secretRef: 'nextauth-secret'
      }
      {
        name: 'GITHUB_CLIENT_ID'
        secretRef: 'github-client-id'
      }
      {
        name: 'GITHUB_CLIENT_SECRET'
        secretRef: 'github-client-secret'
      }
      {
        name: 'GITHUB_APP_ID'
        value: githubAppId
      }
      {
        name: 'GITHUB_APP_PRIVATE_KEY'
        secretRef: 'github-app-private-key'
      }
      {
        name: 'TEST_PW'
        secretRef: 'test-pw'
      }
      {
        name: 'NODE_ENV'
        value: nodeEnv
      }
      {
        name: 'PORT'
        value: '3000'
      }
    ]
    secrets: [
      {
        name: 'github-client-id'
        value: githubClientId
      }
      {
        name: 'github-client-secret'
        value: githubClientSecret
      }
      {
        name: 'nextauth-secret'
        value: nextauthSecret
      }
      {
        name: 'github-app-private-key'
        value: githubAppPrivateKey
      }
      {
        name: 'test-pw'
        value: testPw
      }
    ]
    targetPort: 3000
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output SERVICE_WEB_URL string = web.outputs.uri
output SERVICE_WEB_NAME string = web.outputs.name
