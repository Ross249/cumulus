import { createNoise, UNIFORM_BYTES } from './resources.js';
import { loadShader } from './load-shader.js';

export async function createRenderer(canvas, onError) {
  const gpu = navigator.gpu;
  const adapter = await gpu?.requestAdapter({ powerPreference: 'low-power' });
  if (!adapter) throw new Error('WebGPU is unavailable. Choose WebGL2.');
  const source = await loadShader(new URL('./shaders/cloud.wgsl', import.meta.url));
  const device = await adapter.requestDevice();
  let context, buffer, texture;
  let destroyed = false;
  const error = (event) => onError(new Error(event.error.message));

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    device.removeEventListener('uncapturederror', error);
    context?.unconfigure();
    buffer?.destroy();
    texture?.destroy();
    device.destroy();
  }

  try {
    device.pushErrorScope('validation');
    buffer = device.createBuffer({ size: UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    texture = device.createTexture({ size: [8, 8, 8], dimension: '3d', format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture }, createNoise(), { bytesPerRow: 8, rowsPerImage: 8 }, [8, 8, 8]);
    const sampler = device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat',
      addressModeW: 'repeat', minFilter: 'linear', magFilter: 'linear' });
    const module = device.createShaderModule({ code: source.code });
    const format = gpu.getPreferredCanvasFormat();
    const pipeline = await device.createRenderPipelineAsync({ layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] } });
    const bindings = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer } },
      { binding: 1, resource: texture.createView() },
      { binding: 2, resource: sampler },
    ] });
    const validation = await device.popErrorScope();
    if (validation) throw new Error(validation.message);

    // Acquire the canvas after pipeline validation succeeds.
    context = canvas.getContext('webgpu');
    if (!context) throw new Error('This canvas already uses another renderer. Use a new canvas.');
    context.configure({ device, format, alphaMode: 'premultiplied' });
    device.addEventListener('uncapturederror', error);
    device.lost.then((info) => {
      if (!destroyed) onError(new Error(`WebGPU device lost: ${info.message || info.reason}`));
    });

    return {
      kind: 'webgpu',
      sourceBytes: source.bytes,
      maxSize: [device.limits.maxTextureDimension2D, device.limits.maxTextureDimension2D],
      draw(values) {
        device.queue.writeBuffer(buffer, 0, values);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store',
        }] });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindings);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
