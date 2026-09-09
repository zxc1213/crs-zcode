/**
 * 模板渲染器 - 需求骨架文件的模板加载与落盘
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates');

/**
 * Load template file and substitute ${KEY} placeholders
 * 模板名可含子目录（如 spec/background.md.tpl），resolve 后校验不越出模板目录
 */
export async function loadTemplate(templateName, vars) {
  const root = path.resolve(TEMPLATES_DIR);
  const tplPath = path.resolve(root, String(templateName));
  if (tplPath !== root && !tplPath.startsWith(root + path.sep)) {
    throw new Error(`template path escapes templates directory: ${templateName}`);
  }
  const tpl = await fs.readFile(tplPath, 'utf-8');
  let result = tpl;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`\${${key}}`).join(String(val));
  }
  return result;
}
