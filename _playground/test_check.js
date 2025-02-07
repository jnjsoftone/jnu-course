// * Class Json에 Html Download 반영
const vttInfoFromHtml = async (htmlContent) => {
  const $ = cheerio.load(htmlContent);
  const trackElements = $('track');
  const vttInfos = [];

  for (let i = 0; i < trackElements.length; i++) {
    const track = trackElements[i];
    const src = $(track).attr('src');
    const lang = $(track).attr('srclang') || 'unknown';

    if (src && src.endsWith('.vtt')) {
      const filename = src.split('/').pop();
      vttInfos.push({
        lang,
        name: filename,
      });
    }
  }

  return vttInfos;
};

const classJsonFromHtml = async (classId) => {
  const classHtmlDirs = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
  // '/Users/moon/JnJ-soft/Projects/internal/@jnjsoft/jnj-learn/_repo/class101/html/classes/5c514d81d30c532c446947ba/029_5c7d26a535b52893ce6829f9'
  // const classJsonDir = findFolders(`${CLASS101_JSON_ROOT}/classes/${classId}`);

  const infos = [];

  for (const classHtmlDir of classHtmlDirs) {
    const lectureSn = classHtmlDir.split('/').pop();
    const [snStr, lectureId] = lectureSn.split('_');
    const sn = parseInt(snStr);
    const videoPath = `${classHtmlDir}/video.html`;

    if (!fs.existsSync(videoPath)) {
      continue;
    }
    const htmlContent = loadFile(videoPath);
    const subtitles = await vttInfoFromHtml(htmlContent);
    if (subtitles.length > 0) {
      const subtitlePath = `${classHtmlDir}/subtitles`;
      if (!fs.existsSync(subtitlePath)) {
        console.log(`${classId} 자막 파일 없음: ${subtitlePath}`);
      }
      // console.log(subtitles);
    }
    const lectureInfo = { sn, lectureId, subtitles };
    // console.log(lectureInfo);
    infos.push(lectureInfo);
  }

  saveJson(`${CLASS101_JSON_ROOT}/_classes/${classId}.json`, infos);
  // const classJsonPath = classJsonDir[0];
  // const classJson = loadJson(classJsonPath);
  // return classJson;
};

// # update class json(_classes -> classes)
const updateClassJson = async (classId) => {
  const classJson = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  const classJson_ = loadJson(`${CLASS101_JSON_ROOT}/_classes/${classId}.json`);

  for (const l of classJson_) {
    const targetLecture = classJson.find((c) => c.sn === l.sn);
    if (targetLecture) {
      targetLecture.lectureId = l.lectureId;
      targetLecture.subtitles = l.subtitles;
    }
  }

  saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, classJson);
};

const updateClassJsonAll = async () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    await classJsonFromHtml(c.classId);
    await updateClassJson(c.classId);
  }
};

// 다운로드 보완:classId, lectureId
// downloadLectureSubtitles(classId, lectureId);

// // const classId = '60c705a4e4f358000d671380';
// const classId = '62d3a069072c35000e15c21a';
// // const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);

// // console.log(lectures);
// saveClassLectures(classId, 'update');

// // const classId = '600813bfea24bb000dd0406d';
// classJsonFromHtml('600813bfea24bb000dd0406d');
// updateClassJson('600813bfea24bb000dd0406d');

// * 모든 강의 정보 저장
const updateClassLecturesAll = async () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    await saveClassLectures(c.classId, 'update');
  }
};

// * 자막 파일 복사(subtitles -> video)

const copySubtitles = (classId) => {
  const classJson = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  if (!classJson || classJson.length === 0) {
    return;
  }
  try {
    for (const lecture of classJson) {
      const lectureSlug = getLectureSlug(lecture);
      const subtitleName = lecture.subtitles.find((s) => s.lang === 'ko')?.name;

      const subtitleSrcPath = `${CLASS101_HTML_ROOT}/classes/${classId}/${lectureSlug}/subtitles/${subtitleName}`;
      const subtitleDstPath = `${CLASS101_VIDEO_ROOT}/${classId}/${lectureSlug}.vtt`;
      saveFile(subtitleDstPath, loadFile(subtitleSrcPath));
    }
  } catch (error) {
    console.error(`Error processing class ${classId}:`, error);
  }
};

const copySubtitlesAll = async () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    await copySubtitles(c.classId);
  }
};

// * 모든 강의 정보 저장
const redownClassLecturesAll = async () => {
  const redownLectures = loadJson(`${CLASS101_JSON_ROOT}/redownLectures.json`);
  const uniqueClassIds = [...new Set(redownLectures.map((l) => l.classId))];
  console.log(uniqueClassIds, uniqueClassIds.length);
  // const excepts = [
  //   '63da380c1aa45c000ef4d011',
  //   '65d832e0b03816000e133e6a',
  //   '63bd1f7b0e84ff000e67c862',
  //   '60c705a4e4f358000d671380',
  //   '6495303a17e0fc000e282687',
  //   '64b65c8be78815000ef6a0f6',
  //   '631d98200380e4006470968d',
  // ];

  // // const noLectureIds = ["5ef4d5bfc94e480dcb9f7862", "5d6c7cc15933780c5919e50e", "60e1073626b8e800148165f4", "6495303a17e0fc000e282687", "60c705a4e4f358000d671380"]
  // for (const classId of uniqueClassIds) {
  //   // for (const classId of excepts) {
  //   // for (const classId of noLectureIds) {
  //   // if (excepts.includes(classId)) {
  //   //   console.log(`@@@@@ ${classId} 제외`);
  //   //   continue;
  //   // }
  //   console.log(`@@@@@ ${classId} 강의 정보 저장 중...`);
  //   await saveClassLectures(classId as string, 'update');
  // }
};

const noLectureIds = () => {
  const lectures = loadJson(`${CLASS101_JSON_ROOT}/redownLectures.json`);
  for (const l of lectures) {
    if (!l.lectureId) {
      console.log(l.classId, l.sn);
    }
  }
};

const deleteErrorFolders = (classId) => {
  console.log(`@@@@@ ${classId} 삭제 예정`);
  const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  if (!lectures || lectures.length === 0) {
    return;
  }
  try {
    const lectureNames = lectures.map((lecture) => getLectureSlug(lecture));
    // console.log(lectureNames);
    const folders = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
    for (const folder of folders) {
      const folderName = folder.split('/').pop();
      if (!lectureNames.includes(folderName)) {
        console.log(`${folderName} 삭제 예정`);
        fs.rmdirSync(folder, { recursive: true });
      }
    }
    console.log(`@@@@@ ${lectures.length} / ${folders.length}`);
  } catch (error) {
    console.error(`Error processing class ${classId}:`, error);
  }
};

const deleteErrorFoldersAll = () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    deleteErrorFolders(c.classId);
  }
};

// // * 다시 다운로드할 강의 목록 저장(material, subtitles 없는 강의)
// const saveRedownLectures = () => {
//   const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
//   const redownLectures = [];

//   for (const classId of myclassIds) {
//     const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);

//     for (const lecture of lectures) {
//       if ('subtitles' in lecture && lecture.subtitles.length > 0) {
//         continue;
//       }
//       // const { title, sn, lectureId } = lecture;
//       // redownLectures.push({ classId, title, sn, lectureId });
//       redownLectures.push({ classId, ...lecture });
//     }
//   }

//   saveJson(`${CLASS101_JSON_ROOT}/redownLectures.json`, redownLectures);
// };

// console.log(findFolders(`${CLASS101_HTML_ROOT}/classes/5c514d81d30c532c446947ba`));

// const classId = '5c514d81d30c532c446947ba';
