declare const __BUILD_ID__: string;

const buildId = document.getElementById('build-id');
if (buildId) {
  buildId.textContent = `Build ID: ${__BUILD_ID__}`;
}
