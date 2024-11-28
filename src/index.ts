import { initUntarJS, FilesData } from '@emscripten-forge/untarjs';

const untarjsReady = initUntarJS();

export const installCondaPackage = async (
  prefix: string,
  url: string,
  FS: any,
  verbose: boolean
): Promise<void> => {
  const untarjs = await untarjsReady;

  let files = await untarjs.extract(url);

  if (Object.keys(files).length !== 0) {
    if (url.toLowerCase().endsWith('.conda')) {
      let condaPackage: Uint8Array | undefined = undefined;
      let packageInfo: Uint8Array | undefined = undefined;

      Object.keys(files).map(file => {
        if (file.startsWith('pkg-')) {
          condaPackage = files[file];
        } else if (file.startsWith('info-')) {
          packageInfo = files[file];
        }
      });

      if (condaPackage === undefined || packageInfo === undefined) {
        throw new Error(`Invalid .conda package ${url}`);
      }

      const condaFiles: FilesData = await untarjs.extractData(condaPackage);
      const packageInfoFiles: FilesData = await untarjs.extractData(packageInfo);

      createCondaMetaFile(packageInfoFiles, prefix, FS, verbose);
      saveFiles(prefix, FS, {...condaFiles, ...packageInfoFiles}, verbose);
    } else {
      createCondaMetaFile(files, prefix, FS, verbose);
      saveFiles(prefix, FS, files, verbose);
    }

    return;
  }

  throw new Error(`There is no file in ${url}`);
};

const getSharedLibs = (files: IFileData[], prefix: string): IFileData[] => {
  let sharedLibs: IFileData[] = [];

  sharedLibs = files.filter((file: IFileData) => {
    if (file.filename.endsWith('.so')) {
      return {
        filename: `${prefix ? prefix : '/'}${file.filename}`,
        data: file.data
      };
    }
  });
  return sharedLibs;
};

const saveFiles = (
  prefix: string,
  FS: any,
  files: FilesData,
  verbose: boolean
): void => {
  console.log('Saving files into browser memory');

  try {
    ['site-packages', 'etc', 'share'].forEach(folder => {
      let folderDest = `${prefix}/${folder}`;
      if (folder === 'site-packages') {
        folderDest = `${prefix}/lib/python3.11/site-packages`;
      }
      savingFiles(files, folder, folderDest, FS, verbose);
    });
  } catch (error) {
    console.error(error);
  }
};

const savingFiles = (
  files: FilesData,
  folder: string,
  folderDest: string,
  FS: any,
  verbose: boolean
) => {
  Object.keys(files).forEach(filename => {
    const regexp = new RegExp(`^${folder}`);
    if (filename.match(regexp)) {
      if (!FS.analyzePath(folderDest).exists) {
        FS.mkdirTree(folderDest);
      }
      if (verbose) {
        console.log(`Writing a file for ${folderDest} folder`, filename);
      }
      writeFile(files[filename], filename, FS, folder, folderDest, verbose);
    }
  });
};

const writeFile = (
  data: Uint8Array,
  fullPath: string,
  FS: any,
  folder: string,
  folderDest: string,
  verbose: boolean
): void => {
  let fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1);

  let directoryPathes = fullPath.replace(new RegExp(`\/${fileName}`), '');
  if (directoryPathes.match(folder)) {
    directoryPathes = directoryPathes.replace(new RegExp(`${folder}`), '');
  }

  let destPath = `${folderDest}${directoryPathes}/`;
  if (destPath) {
    if (!FS.analyzePath(destPath).exists) {
      FS.mkdirTree(destPath);
    }
  }

  destPath = `${destPath}${fileName}`;

  if (verbose) {
    console.log(`Saving files into ${destPath}`);
  }

  let encodedData = new TextDecoder('utf-8').decode(data);
  FS.writeFile(destPath, encodedData);
};

const createCondaMetaFile = (
  files: FilesData,
  prefix: string,
  FS: any,
  verbose: boolean
) => {
  let infoData: Uint8Array = new Uint8Array();

  Object.keys(files).map((filename) => {
    let regexp = 'index.json';

    if (filename.match(regexp)) {
      infoData = files[filename];
    }
  });

  if (infoData.length) {
    let info = new TextDecoder('utf-8').decode(infoData);
    try {
      let condaPackageInfo = JSON.parse(info);
      const condaMetaDir = `${prefix}/conda-meta`;
      const path = `${condaMetaDir}/${condaPackageInfo.name}-${condaPackageInfo.version}-${condaPackageInfo.build}.json`;
      const pkgCondaMeta = {
        name: condaPackageInfo.name,
        version: condaPackageInfo.version,
        build: condaPackageInfo.build,
        build_number: condaPackageInfo.build_number
      };

      if (!FS.analyzePath(`${condaMetaDir}`).exists) {
        FS.mkdirTree(`${condaMetaDir}`);
      }

      if (verbose) {
        console.log(
          `Creating conda-meta file for ${condaPackageInfo.name}-${condaPackageInfo.version}-${condaPackageInfo.build} package`
        );
      }
      FS.writeFile(path, JSON.stringify(pkgCondaMeta));
    } catch (error) {
      console.error(error);
    }
  }
};

export const bootstrapFromEmpackPackedEnvironment = async (
  packagesJsonUrl: string,
  verbose: boolean = true,
  skipLoadingSharedLibs: boolean = false,
  Module: any
) => {
  if (verbose) {
    console.log('fetching packages.json from', packagesJsonUrl);
  }

  // fetch json with list of all packages
  let empackEnvMeta = await fetchJson(packagesJsonUrl);
  let allPackages: IEmpackEnvMetaPkg[] = empackEnvMeta.packages;
  let prefix = empackEnvMeta.prefix;

  console.log('allPackages', allPackages);

  if (verbose) {
    console.log('makeDirs');
  }
  //Module.create_directories("/package_tarballs");

  // enusre there is python and split it from the rest
  if (verbose) {
    console.log('splitPackages');
  }
  let splitted: ISplittedPackages = splitPackages(allPackages);
  let packages = splitted.packages;
  let pythonPackage: IEmpackEnvMetaPkg = splitted.pythonPackage;
  let pythonVersion = pythonPackage.version.split('.').map(x => parseInt(x));

  // fetch init python itself
  console.log('--bootstrap_python');
  if (verbose) {
    console.log('bootstrap_python');
  }
  //TO Do
  //let python_is_ready_promise = bootstrap_python(prefix, package_tarballs_root_url, pythonPackage, verbose);

  // create array with size
  if (verbose) {
    console.log('fetchAndUntarAll');
  }

  let sharedLibs = await Promise.all(
    packages.map(pkg => installCondaPackage(prefix, pkg.url, Module.FS, verbose))
  );

  console.log(`sharedLibs`, sharedLibs);

 /* if (!skipLoadingSharedLibs) {
    loadShareLibs(packages, sharedLibs, prefix, pythonVersion);
  }*/
};

const splitPackages = (packages: IEmpackEnvMetaPkg[]) => {
  let pythonPackage: IEmpackEnvMetaPkg | undefined = undefined;
  for (let i = 0; i < packages.length; i++) {
    if (packages[i].name == 'python') {
      pythonPackage = packages[i];
      packages.splice(i, 1);
      break;
    }
  }
  if (pythonPackage == undefined) {
    throw new Error('no python package found in package.json');
  }
  return { pythonPackage, packages };
};

/*async function bootstrap_python(
  prefix,
  package_tarballs_root_url,
  pythonPackage,
  verbose
) {}*/

const loadShareLibs = (packages:IEmpackEnvMetaPkg[], sharedLibs:IFileData[], prefix: string, pythonVersion: string) => {
  // instantiate all packages
  packages.map((pkg, i) => {
    // if we have any shared libraries, load them
    if (sharedLibs[i]) {
      loadDynlibsFromPackage(
        prefix,
        pythonVersion,
        packages[i].name,
        false,
        sharedLibs[i]
      );
    }
  })
};
export default {
  installCondaPackage,
  bootstrapFromEmpackPackedEnvironment
};
