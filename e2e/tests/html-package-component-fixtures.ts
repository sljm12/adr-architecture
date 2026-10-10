import JSZip from 'jszip';
import { assembleHtmlPackageSnapshot, renderAggregateHtmlPackage } from '../../shared/src/index';
import { componentPackageInput } from '../../shared/tests/component-package-input';

export async function componentPackageArchive(level: 'general' | 'container' | 'component' = 'general') {
  const input = componentPackageInput(level);
  input.child.components[0].name = 'Handler <script> & "quoted"';
  const snapshot = assembleHtmlPackageSnapshot(input.capture, input.source);
  const files = renderAggregateHtmlPackage(snapshot), zip = new JSZip();
  for (const [path, text] of Object.entries(files)) zip.file(path, text);
  return { ...input, files, bytes: await zip.generateAsync({ type: 'nodebuffer' }) };
}
