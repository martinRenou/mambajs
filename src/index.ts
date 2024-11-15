import {
  extract,
  IFileData,
  extractData
} from '@emscripten-forge/untarjs';

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
        let condaPackage = files.filter(file => {
          if (file.filename.startsWith('pkg-')) {
            return file;
          }
        });
        condaPackage.map(async pkg => {
          const condaFiles: IFileData[] = await extractData(pkg.data);
          saveFiles(prefix, FS, condaFiles, verbose);
        });
      } else {
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
    let filteredFilesPkg = files.filter(file => {
      let regexp = 'site-packages';
      if (file.filename.match(regexp)) {
        return file;
      }
    });

    console.log('filteredFilesPkg', filteredFilesPkg);

    let destDir = `${prefix}/lib/python3.11/site-packages`;

    if (!FS.analyzePath(destDir).exists) {
      FS.mkdirTree(destDir);
    }

    filteredFilesPkg.map(file => {
      writeFile(
        file.data,
        file.filename,
        FS,
        'site-packages',
        destDir,
        verbose
      );
    });

    ['etc', 'share'].forEach(folder => {
      let folderDest = `${prefix}/${folder}`;

      files.map(file => {
        let regexp = `${folder}`;
        if (file.filename.match(regexp)) {
          console.log('files for etc and share', file.filename);
          writeFile(file.data, file.filename, FS, folder, folderDest, verbose);
        }
      });
    });
  } catch (e) {
    console.error('ERROR', e);
    throw e;
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

export default {
  installCondaPackage
};
