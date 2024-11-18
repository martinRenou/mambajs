import { extract, IFileData, extractData } from '@emscripten-forge/untarjs';

export const installCondaPackage = async (
  prefix: string,
  url: string,
  FS: any,
  verbose: false
): Promise<void> => {
  try {
    let files: IFileData[] = await extract(url);
    if (files.length !== 0) {
      console.log('exctracted files', files);
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
        createCondaMetaFile(packageInfoFiles, prefix, FS);
        let mergedFiles = [...condaFiles, ...packageInfoFiles];
        saveFiles(prefix, FS, mergedFiles, verbose);
      } else {
        createCondaMetaFile(files, prefix, FS);
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
  verbose: false
): void => {
  try {
    ['info', 'site-packages', 'etc', 'share'].forEach(folder => {
      let folderDest = `${prefix}/${folder}`;
      if ((folder = 'site-packages')) {
        folderDest = `${prefix}/lib/python3.11/site-packages`;
      }

      files.map(file => {
        let regexp = `${folder}`;
        if (file.filename.match(regexp)) {
          if (!FS.analyzePath(folderDest).exists) {
            FS.mkdirTree(folderDest);
          }
          console.log(`files for ${folderDest} folder`, file.filename);
          writeFile(file.data, file.filename, FS, folder, folderDest, verbose);
        }
      });
    });
  } catch (error) {
    console.error(error);
  }
};

const writeFile = (
  data: Uint8Array,
  filename: string,
  FS: any,
  folder: string,
  folderDest: string,
  verbose: false
): void => {
  let regexp = `${folder}`;
  if (filename.match(regexp)) {
    const regexp = `${folder}\/(.+?)\/[^\/]+$`;

    let directoryPathes = getDirectoryPathes(filename, regexp);
    console.log(directoryPathes);
    let destPath = `${folderDest}/${directoryPathes}`;
    if (destPath) {
      if (!FS.analyzePath(destPath).exists) {
        FS.mkdirTree(destPath);
      }
    }

    let fileName = filename.substring(filename.lastIndexOf('/') + 1);
    console.log('fileName', fileName);

    destPath = `${destPath}${fileName}`;

    if (verbose) {
      console.log(`Saving files into ${destPath}`);
    }

    let encodedData = new TextDecoder('utf-8').decode(data);
    FS.writeFile(destPath, encodedData);
  }
};

const getDirectoryPathes = (filename: string, regexp: any): string => {
  let match = filename.match(regexp);
  let directoryPathes = match ? match[1] : '';
  return directoryPathes;
};

const createCondaMetaFile = (files: IFileData[], prefix: string, FS: any) => {
  let infoData: Uint8Array = new Uint8Array();

  files.map((file: IFileData) => {
    let regexp = 'info.json';

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
        FS.mkdirTree(`${prefix}/conda-meta`);
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
