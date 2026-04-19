import type { Rule } from '../core/rule.js';
import { noRequiredFalse } from './no-required-false.js';
import { noContentEncoding } from './no-content-encoding.js';
import { descriptionExists } from './description-exists.js';
import { noEmptyEnum } from './no-empty-enum.js';
import { maxDepth } from './max-depth.js';
import { noRecursiveRefs } from './no-recursive-refs.js';
import { validJsonSchemaSubset } from './valid-json-schema-subset.js';
import { noUnsupportedFormats } from './no-unsupported-formats.js';
import { claudeNoTypeArray } from './client-specific/claude.js';
import { cursorNoDefaultWithoutType } from './client-specific/cursor.js';
import { geminiNoOptionalWithoutDefault, geminiNoNestedObjects } from './client-specific/gemini.js';
import { vscodeMaxParams } from './client-specific/vscode.js';
import { windsurfNoUnionTypes } from './client-specific/windsurf.js';
import { clineDescriptionMaxLength } from './client-specific/cline.js';

export const allRules: Rule[] = [
  noRequiredFalse,
  noContentEncoding,
  descriptionExists,
  noEmptyEnum,
  maxDepth,
  noRecursiveRefs,
  validJsonSchemaSubset,
  noUnsupportedFormats,
  claudeNoTypeArray,
  cursorNoDefaultWithoutType,
  geminiNoOptionalWithoutDefault,
  geminiNoNestedObjects,
  vscodeMaxParams,
  windsurfNoUnionTypes,
  clineDescriptionMaxLength,
];
