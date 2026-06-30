import { createBackendHandler, createRuntimeDependencies } from './_lib/router.js';

const handler = createBackendHandler(createRuntimeDependencies());

export default handler;
