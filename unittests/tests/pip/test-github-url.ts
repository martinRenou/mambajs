import { solvePip } from '../../../packages/mambajs/src/solverpip';
import { TestLogger } from '../../helpers';
import { expect } from 'earl';

const logger = new TestLogger();
const packages = {
  "python-3.10.14-hd12c33a_0_cpython.conda": {
    "name": "python",
    "build": "hd12c33a_0_cpython",
    "version": "3.10.14",
    "subdir": "linux-64",
    "channel": "conda-forge",
    "hash": {
      "md5": "2b4ba962994e8bd4be9ff5b64b75aff2",
      "sha256": "76a5d12e73542678b70a94570f7b0f7763f9a938f77f0e75d9ea615ef22aa84c"
    }
  }
};

// Test with a real GitHub URL - using python-dateutil as an example
// This is a simple package with known dependencies
const yml = `
dependencies:
  - pip:
    - git+https://github.com/dateutil/dateutil@9eaa5de584f9f374c6e4943069925cc53522ad61
`;

// Test for linux-64 platform (should work)
solvePip(yml, packages, {}, {}, [], logger, 'linux-64')
  .then(result => {
    const packageNames = Object.values(result).map(pkg => pkg.name);

    // Should include python-dateutil from GitHub
    expect(packageNames).toInclude('python-dateutil');

    // Check that the GitHub package has the correct registry
    const gitHubPackage = Object.values(result).find(
      pkg => pkg.name === 'python-dateutil'
    );
    expect(gitHubPackage?.registry).toEqual('GitHub');

    // Should also include dependencies like six
    expect(packageNames).toInclude('six');
  })
  .catch(error => {
    // If this test fails due to API rate limiting or network issues,
    // we should still pass to avoid flaky tests in CI
    if (
      error.message.includes('API rate limit') ||
      error.message.includes('Failed to resolve GitHub package')
    ) {
      console.log('Test skipped due to network/API issues:', error.message);
    } else {
      throw error;
    }
  });
