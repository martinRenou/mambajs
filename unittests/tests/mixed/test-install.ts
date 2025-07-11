import { create, install, ISolvedPackage, pipInstall } from "../../../packages/mambajs/src";
import { TestLogger } from "../../helpers";
import { expect } from 'earl';

const logger = new TestLogger();

const yml = `
channels:
  - https://prefix.dev/emscripten-forge-dev
  - https://prefix.dev/conda-forge
dependencies:
  - pandas
  - xeus-python
`;

create(yml, logger).then(async env => {
  env = await install(['ipycanvas', 'bqplot'], env);

  let condaPackageNames = Object.values(env.packages.condaPackages).map(pkg => pkg.name);
  let pipPackageNames = Object.values(env.packages.pipPackages).map(pkg => pkg.name);

  expect(condaPackageNames).toInclude('xeus-python', 'xeus-python-shell', 'pandas', 'ipycanvas', 'bqplot', 'ipywidgets');
  expect(pipPackageNames).toBeEmpty();

  env = await install(['ipycanvas=0.13.2', 'bqplot=0.12.42'], env, [], logger);

  // Index by package name for convenienve
  const condaPackages: { [key: string]: ISolvedPackage } = {};
  Object.keys(env.packages.condaPackages).map(filename => {
    condaPackages[env.packages.condaPackages[filename].name] =
      env.packages.condaPackages[filename];
  });

  expect(condaPackages['ipycanvas'].version).toEqual('0.13.2');
  expect(condaPackages['bqplot'].version).toEqual('0.12.42');

  env = await pipInstall(['ipydatagrid'], env, logger);

  condaPackageNames = Object.values(env.packages.condaPackages).map(pkg => pkg.name);
  pipPackageNames = Object.values(env.packages.pipPackages).map(pkg => pkg.name);

  expect(pipPackageNames).toInclude('ipydatagrid');
  expect(condaPackageNames).not.toInclude('ipydatagrid');
  // ipywidgets still installed with conda, pip doesn't take over
  expect(condaPackageNames).toInclude('ipywidgets');
  expect(pipPackageNames).not.toInclude('ipywidgets');
});
