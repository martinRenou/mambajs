import { solvePip } from '../../../packages/mambajs/src/solverpip';
import { TestLogger } from '../../helpers';
import { expect } from 'earl';

const logger = new TestLogger();

// Test with GitHub URL on emscripten-wasm32 platform (should fail)
const yml = `
dependencies:
  - pip:
    - git+https://github.com/dateutil/dateutil@9eaa5de584f9f374c6e4943069925cc53522ad61
`;

// Test for emscripten-wasm32 platform (should throw error)
solvePip(yml, {}, {}, {}, [], logger, 'emscripten-wasm32')
  .then(() => {
    throw new Error(
      'Expected an error when installing GitHub URL on emscripten-wasm32'
    );
  })
  .catch(error => {
    // Should fail with appropriate error message
    expect(error.message).toInclude('emscripten-wasm32');
    expect(error.message).toInclude('GitHub');
  });
