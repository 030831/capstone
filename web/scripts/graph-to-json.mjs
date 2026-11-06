// ../graph/graph_v0.yaml (단일 진실 원천) -> src/data/graph_v0.json
// YAML 원본은 수정·복사하지 않고, 앱이 쓰는 JSON 만 생성한다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../graph/graph_v0.yaml');
const dst = resolve(here, '../src/data/graph_v0.json');

const spec = yaml.load(readFileSync(src, 'utf-8'));
if (!spec || !Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
  console.error('graph_v0.yaml 형식 오류: nodes/edges 배열이 필요합니다.');
  process.exit(1);
}
mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, JSON.stringify(spec, null, 2) + '\n', 'utf-8');
console.log(`graph_v0.json 생성: 노드 ${spec.nodes.length}개, 엣지 ${spec.edges.length}개 -> ${dst}`);
