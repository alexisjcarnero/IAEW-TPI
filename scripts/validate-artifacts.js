const fs = require('fs');
const path = require('path');
const vm = require('vm');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const openapi = YAML.parse(fs.readFileSync(path.join(root, 'docs/api/openapi.yaml'), 'utf8'));

if (openapi.openapi !== '3.1.0' || !openapi.paths || !openapi.components?.securitySchemes) {
  throw new Error('El contrato no contiene la estructura OpenAPI 3.1 requerida.');
}

const compose = YAML.parse(fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8'));
const requiredServices = ['api', 'db', 'rabbitmq', 'worker', 'webhook-receiver', 'prometheus', 'grafana'];
for (const service of requiredServices) {
  if (!compose.services?.[service]) throw new Error(`Falta el servicio ${service} en Docker Compose.`);
}
for (const file of [
  'observability/prometheus.yml',
  'observability/grafana/provisioning/datasources/prometheus.yml',
  'observability/grafana/provisioning/dashboards/dashboards.yml',
]) {
  YAML.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

for (const file of [
  'tests/postman/Mesa-de-ayuda.postman_collection.json',
  'tests/postman/Local.postman_environment.json',
  'observability/grafana/dashboards/mesa-ayuda.json',
]) {
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

const postman = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/postman/Mesa-de-ayuda.postman_collection.json'), 'utf8')
);
function validatePostmanScripts(node, label) {
  for (const event of node.event || []) {
    if (event.script?.exec) {
      new vm.Script(event.script.exec.join('\n'), { filename: `${label}:${event.listen}` });
    }
  }
  for (const item of node.item || []) validatePostmanScripts(item, item.name);
}
validatePostmanScripts(postman, postman.info.name);

const jmx = fs.readFileSync(path.join(root, 'tests/load/mesa-ayuda.jmx'), 'utf8');
if (!jmx.includes('<jmeterTestPlan') || !jmx.includes('</jmeterTestPlan>')) {
  throw new Error('El plan JMeter no tiene una raiz valida.');
}

console.log('OpenAPI, Compose, observabilidad, Postman, Grafana y JMeter: estructura valida.');
