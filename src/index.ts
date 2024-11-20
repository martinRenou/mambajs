import { extract, extractData, IFileData } from '@emscripten-forge/untarjs';

export const installCondaPackage = async (
  prefix: string,
  url: string,
  FS: any,
  verbose: boolean
): Promise<void> => {
  try {
    let files: IFileData[] = await extract(url);
    if (files.length !== 0) {
      if (url.toLowerCase().endsWith('.conda')) {
        let condaPackage: IFileData = {
          filename: '',
          data: new Uint8Array()
        };

        let packageInfo: IFileData = {
          filename: '',
          data: new Uint8Array()
        };

        files.map(file => {
          if (file.filename.startsWith('pkg-')) {
            condaPackage = file;
          } else if (file.filename.startsWith('info-')) {
            packageInfo = file;
          }
        });
        const condaFiles: IFileData[] = await extractData(condaPackage.data);
        const packageInfoFiles: IFileData[] = await extractData(
          packageInfo.data
        );
        createCondaMetaFile(packageInfoFiles, prefix, FS, verbose);
        let mergedFiles = [...condaFiles, ...packageInfoFiles];
        saveFiles(prefix, FS, mergedFiles, verbose);
      } else {
        createCondaMetaFile(files, prefix, FS, verbose);
        saveFiles(prefix, FS, files, verbose);
      }
    } else {
      console.log('There is no files');
    }
  } catch (error) {
    console.log(error);
  }
};

const saveFiles = (
  prefix: string,
  FS: any,
  files: IFileData[],
  verbose: boolean
): void => {
  console.log('Saving files into browser memory');

  try {
    ['site-packages', 'info', 'etc', 'share'].forEach(folder => {
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
  files: IFileData[],
  folder: string,
  folderDest: string,
  FS: any,
  verbose: boolean
) => {
  files.forEach(file => {
    const regexp = new RegExp(`^${folder}`);
    if (file.filename.match(regexp)) {
      if (!FS.analyzePath(folderDest).exists) {
        FS.mkdirTree(folderDest);
      }
      if (verbose) {
        console.log(`Writing a file for ${folderDest} folder`, file.filename);
      }
      writeFile(file.data, file.filename, FS, folder, folderDest, verbose);
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
  files: IFileData[],
  prefix: string,
  FS: any,
  verbose: boolean
) => {
  let infoData: Uint8Array = new Uint8Array();

  files.map((file: IFileData) => {
    let regexp = 'index.json';

    if (file.filename.match(regexp)) {
      infoData = file.data;
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

export default {
  installCondaPackage
};
