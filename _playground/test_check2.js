import { loadJson, saveJson, PLATFORM, findFolders } from 'jnu-abc';
import dotenv from 'dotenv';

dotenv.config({ path: `../.env.${PLATFORM}` });

const { CLASS101_HTML_ROOT, CLASS101_JSON_ROOT } = process.env;

/*
 * 중복된 lectureId가 있는지 확인
 * @param classId: 강의 번호
 * @return boolean: 중복된 lectureId가 있는지 여부
 */
const hasOverlappedLecture = (classId) => {
  const classObj = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  // * 중복된 lectureId가 있는지 확인
  const lectureIds = classObj.map((l) => l.lectureId);
  const uniqueLectureIds = [...new Set(lectureIds)];
  return lectureIds.length !== uniqueLectureIds.length;
};

/*
 * 중복된 lectureId가 있는 강의 번호 추출
 * @param myclasses: 강의 목록
 * @return overlappedClassIds: 중복된 lectureId가 있는 강의 번호 목록
 */
const findOverlappedClassIds = (save = true) => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  const overlappedClassIds = [];

  for (const c of myclasses) {
    if (hasOverlappedLecture(c.classId)) {
      overlappedClassIds.push(c.classId);
    }
  }
  saveJson(`${CLASS101_JSON_ROOT}/overlappedClassIds.json`, overlappedClassIds);
  return overlappedClassIds;
};

/*
 * 중복된 lectureId가 있는 강의 lecture 목록 추출
 * @param myclasses: 강의 목록
 * @return overlappedLectures: 중복된 lectureId가 있는 lecture 목록
 */
const findOverlappedLectures = (save = true) => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  const overlappedLectures = [];

  for (const c of myclasses) {
    const classObj = loadJson(`${CLASS101_JSON_ROOT}/classes/${c.classId}.json`);

    // lectureId별 강의 목록 생성
    const lectureMap = new Map();
    classObj.forEach((lecture) => {
      if (lecture.lectureId) {
        if (!lectureMap.has(lecture.lectureId)) {
          lectureMap.set(lecture.lectureId, []);
        }
        lectureMap.get(lecture.lectureId).push({
          classId: c.classId,
          sn: lecture.sn,
          lectureId: lecture.lectureId,
          title: lecture.title,
        });
      }
    });

    // 중복된 lectureId 찾기
    for (const [lectureId, lectures] of lectureMap) {
      if (lectures.length > 1) {
        console.log(`중복 발견 - classId: ${c.classId}, lectureId: ${lectureId}`);
        console.log('중복된 강의들:', lectures);
        overlappedLectures.push(...lectures);
      }
    }
  }

  // 결과 저장
  if (overlappedLectures.length > 0) {
    saveJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`, overlappedLectures);
    console.log(`총 ${overlappedLectures.length}개의 중복 강의 발견`);
  }

  if (save) {
    saveJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`, overlappedLectures);
  }
  return overlappedLectures;
};

/*
 * 중복된 sn이 있는 강의 html 목록 추출
 * @param save: 결과 저장 여부
 * @return overlappedHtmls: 중복된 sn이 있는 html 목록
 */
const findOverlappedHtmls = (save = false) => {
  const classIds = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`).map((c) => c.classId);
  const overlappedHtmls = [];

  for (const classId of classIds) {
    const folders = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
    const folderNames = folders.map((f) => f.split('/').pop());
    const prefixes = folderNames.map((f) => f.split('_')[0]);
    console.log(`prefixes: ${prefixes}`);
    const duplicates = prefixes.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});

    for (const [prefix, count] of Object.entries(duplicates)) {
      if (count > 1) {
        const lectureIds = folderNames.filter((f) => f.startsWith(prefix)).map((f) => f.split('_')[1]);
        // console.log(`접두사 ${prefix}는 ${count}번 중복됩니다.`);
        overlappedHtmls.push({
          classId,
          prefix,
          count,
          lectureIds,
        });
      }
      if (count > 2) {
        console.log(`3번 이상 중복된 강의: ${classId} / ${prefix} / ${count}번 중복됩니다.`);
      }
    }
  }

  if (save) {
    saveJson(`${CLASS101_JSON_ROOT}/overlappedHtmls.json`, overlappedHtmls);
  }

  return overlappedHtmls;
};

/*
 * sn보다 작은 lectureId 목록 추출
 * @param classId: 강의 번호
 * @param sn: 강의 번호
 * @return lectureIds: sn보다 작은 lectureId 목록
 */
function findLectureIdsLessThanSn(classId, sn) {
  const classObj = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  const lectureIds = classObj.filter((l) => l.sn < sn).map((l) => l.lectureId);
  return lectureIds;
}

/*
 * 중복된 sn이 있는 강의 html 목록 체크
 * @param save: 결과 저장 여부
 * @return {correctLectureIds, wrongLectureIds}: 올바른 lectureId 목록, 올바르지 않은 lectureId 목록
 */
function checkOverlappedHtmls(save = false) {
  const correctLectureIds = [];
  const wrongLectureIds = [];
  const overlappedHtmls = loadJson(`${CLASS101_JSON_ROOT}/overlappedHtmls.json`);
  console.log('-------------------------------------------------');
  console.log(`overlappedHtmls: ${JSON.stringify(overlappedHtmls, null, 2)}`);
  console.log('-------------------------------------------------');

  for (const overlappedHtml of overlappedHtmls) {
    const classId = overlappedHtml.classId;
    const sn = parseInt(overlappedHtml.prefix);
    const beforeLectureIds = findLectureIdsLessThanSn(classId, sn);
    const lectureIds = overlappedHtml.lectureIds;
    console.log(`### checking ${classId} / ${sn} / ${lectureIds}`);
    for (const lectureId of lectureIds) {
      if (beforeLectureIds.includes(lectureId)) {
        console.log(`중복된 강의: ${classId} / ${sn} / ${lectureId}`);
        wrongLectureIds.push({
          classId,
          sn,
          lectureId,
        });
      } else {
        console.log(`중복되지 않은 강의: ${classId} / ${sn} / ${lectureId}`);
        correctLectureIds.push({
          classId,
          sn,
          lectureId,
        });
      }
    }
  }
  if (save) {
    saveJson(`${CLASS101_JSON_ROOT}/_correctLectureIds.json`, correctLectureIds);
    saveJson(`${CLASS101_JSON_ROOT}/_wrongLectureIds.json`, wrongLectureIds);
  }
  return {
    correctLectureIds,
    wrongLectureIds,
  };
}

function removeWrongHtmlFolders() {
  const wrongLectureIds = loadJson(`${CLASS101_JSON_ROOT}/_wrongLectureIds.json`);
  for (const wrongLectureId of wrongLectureIds) {
    const folderName = `${wrongLectureId.sn.toString().padStart(3, '0')}_${wrongLectureId.lectureId}`;
    const folderPath = `${CLASS101_HTML_ROOT}/classes/${wrongLectureId.classId}/${folderName}`;
    if (fs.existsSync(folderPath)) {
      console.log(`삭제 예정: ${folderPath}`);
      fs.rmdirSync(folderPath, { recursive: true });
    }
  }
}

function correctClassJson() {
  const correctLectureIds = loadJson(`${CLASS101_JSON_ROOT}/_correctLectureIds.json`);
  for (const correctLecture of correctLectureIds) {
    const jsonPath = `${CLASS101_JSON_ROOT}/classes/${correctLecture.classId}.json`;
    const classObj = loadJson(jsonPath);
    const targetLecture = classObj.find((l) => l.sn === correctLecture.sn);
    targetLecture.lectureId = correctLecture.lectureId;
    saveJson(jsonPath, classObj);
  }
}

// for (const folderName of folderNames){
//     const sn = folderName.split('_')[0];
//     if (folderNames.includes()){
//         console.log(folderName);
//     }
// }

// * 중복 강의 정보 재추출
// const classId = "5fd5b0e9d56d4e001538b829" // 인간관계
// const classId = "606e2ce995f580000e2da438" // 스토리
// await saveClassLectures(classId, 'update', 46);
// const html = loadFile(`${CLASS101_HTML_ROOT}/classes/606e2ce995f580000e2da438/index.html`);
// const lectures = extractLectures(html);
// console.log(lectures, lectures.length);

// // *
// const correctLectures = loadJson(`${CLASS101_JSON_ROOT}/_correctLectureIds_3.json`);
// const redownLectures = [];
// const redownClassIds = []

// for (const correctLecture of correctLectures){
//     if (!redownClassIds.includes(correctLecture.classId)) {
//         redownClassIds.push(correctLecture.classId);
//         redownLectures.push({
//             classId: correctLecture.classId,
//             lectures: [
//                 {sn: correctLecture.sn, lectureId: correctLecture.lectureId}
//             ]
//         });
//     } else {
//         redownLectures.find((l)=>l.classId === correctLecture.classId).lectures.push({sn: correctLecture.sn, lectureId: correctLecture.lectureId});
//     }
// }

// saveJson(`${CLASS101_JSON_ROOT}/_redownLectures.json`, redownLectures);

// await saveClassLectures(correctLecture.classId, 'update', [correctLecture.sn]);

// saveJson(`${CLASS101_JSON_ROOT}/_redownLectures.json`, redownLectures);

// // * !!!! 다시 다운로드
// const redownClassLectures = loadJson(`${CLASS101_JSON_ROOT}/_redownLectures.json`);

// for (const redownClassLecture of redownClassLectures) {
//   await saveClassLectures(redownClassLecture.classId, 'update', redownClassLecture.lectures);
// }

// const foldersFromJson = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`).map((lecture)=>`${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`);
// console.log(folders.map((f)=>f.split('/').pop()));
// console.log(foldersFromJson);

// const processedFolders = []

// const redownLectures = async (classId)=>{
//     console.log(`@@@@@ ${classId} 강의 정보 저장 중...`);
//     let chrome = null;
//     const url = `https://class101.net/ko/classes/${classId}`;
//     chrome = await goToUrl(url);
//     await sleepAsync(3000);
//     const html = await chrome.getPageSource();

//     const errorLectures = loadJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`).filter((_, index) => index % 2 === 1)
//     const _lectures = errorLectures.filter((l)=>l.classId === classId);
//     const firstSn = _lectures[0].sn;
//     // console.log(sns);
//     // const sns = errorLectures.filter((l)=>l.classId === classId).map((l)=>l.sn);
//     // console.log(sns);

//     const lectures = extractLectures(html);  // 강의 목록
//     saveJson(`${CLASS101_JSON_ROOT}/lectures_${classId}.json`, lectures);
//     // const lectures = extractLectures(html, sns);  // 강의 목록
//     console.log(lectures);
//     const originalLectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
//     for (const lecture of lectures){
//         if (lecture.sn < firstSn - 2) {
//             continue;
//         }
//         // if (_lectures.find((l)=>l.sn !== lecture.sn)) {
//         //     // await sleepAsync(1000);
//         //     console.log(`skip: ${lecture.sn}`);
//         //     continue;
//         // }
//         // console.log(`!!!!!!! ${lecture.sn}`);
//         try {
//             // * 강의 버튼 클릭
//             // 제목으로 버튼 찾기 (따옴표 처리)
//             const escapedTitle = lecture.title.replace(/"/g, "', '\"', '");
//             console.log(`escapedTitle: ${escapedTitle}`);
//             console.log(`####강의 정보 수집중: ${lecture.title} (${lecture.sn}번째)`);
//             // const xpath_ = `//button[contains(@class, "css-1hvtp3b")][.//span[contains(@class, "css-1h8wj8h")]]`;
//             const xpath_ = `//button[@class="css-1hvtp3b"][.//span[@class="css-1h8wj8h" or @class="css-9a1m73"]]`;
//             // css-9a1m73
//             const titleButtons = await chrome.driver.findElements(By.xpath(xpath_));
//             let button = titleButtons[lecture.sn - 1];
//             if (!button) {
//                 console.error(`@@@@@@@@@@@@@@@@@@@@@@강의 버튼을 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
//                 // continue;
//                 return;
//             }
//             await button.click();

//             // const videoCss = 'div#vjs_video_3 > video';
//             const videoCss = 'video';
//             // await chrome.waitForElementVisible('div#vjs_video_3 > video');
//             try {
//                 await chrome.driver.wait(until.elementLocated(By.css(videoCss)), 5000);
//             } catch (error) {
//                 console.error(`!!!!강의 비디오를 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
//             // continue;
//             }
//             await sleepAsync(2000);
//             // * lectureId 추출
//             const url_ = await chrome.driver.getCurrentUrl();
//             const lectureId = url_.split('/')[7];
//             console.log(`lectureId: ${lectureId}`);
//             lecture.lectureId = lectureId;

//             // 원본 강의에서 동일한 sn을 가진 강의 찾기
//             const originalLecture = originalLectures.find(l => l.sn === lecture.sn);
//             if (originalLecture && originalLecture.lectureId === lectureId && originalLecture.title === lecture.title) {
//                 // console.log(`XXXX이미 처리된 강의입니다: ${lecture.title} (${lecture.sn}번째)`);
//                 continue;
//             }

//             console.log(`!!!!!!!!!!!!!!!!!!!!! 처리 중: ${lecture.title} (${lecture.sn}번째)`);

//             // * video division html 저장
//             const lectureDir = `${CLASS101_HTML_ROOT}/classes/${classId}/${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`;
//             const html = await chrome.getElementHtml(videoCss);
//             saveFile(`${lectureDir}/video.html`, html, {
//                 newFile: false
//             });
//             // * 수업자료 추출
//             await getMaterial(lecture, lectureDir, chrome);
//             // * 자막 다운로드(추가)
//             await downloadLectureSubtitles(classId, lectureId);
//             // !! 자막 정보 저장 추가
//             const vttInfos = await downloadVttFiles(html, `${lectureDir}/subtitles`);
//             lecture.subtitles = vttInfos;
//             // * 원본 강의 정보 업데이트
//             const targetIndex = originalLectures.findIndex((l) => l.sn === lecture.sn);
//             if (targetIndex !== -1) {
//                 originalLectures[targetIndex] = lecture;
//             }
//             saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, originalLectures);
//         } catch (error) {
//             // 타입 명시
//             console.error(`강의 처리 중 오류 발생 (${lecture.title}):`, error);
//             // 브라우저가 닫혔다면 다시 열기
//             if (error.name === 'NoSuchWindowError') {
//                 if (chrome) {
//                     await chrome.close();
//                 }
//                 chrome = await goToUrl(url);
//                 await sleepAsync(5000);
//             }
//             continue;
//         }
//     }
//     // 최종 결과 저장
//     // saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
// };

// const classIds = loadJson(`${CLASS101_JSON_ROOT}/overlappedClassIds.json`);
// // // const classId = '5fd5b0e9d56d4e001538b829';
// // const classIds = ['5e71ab3edd13f46aa1bbe1fe']
// for (const classId of classIds){
//     if (classId === '5e71ab3edd13f46aa1bbe1fe') {
//         continue;
//     }
//     await redownLectures(classId)
// }

// const originalLectures = loadJson(`${CLASS101_JSON_ROOT}/classes/5e71ab3edd13f46aa1bbe1fe.json`);
// console.log(originalLectures);

// // 실행 예시:
// const overlappedLectures = findOverlappedLectures();

// // * 디렉토리 삭제
// const errorClassIds = loadJson(`${CLASS101_JSON_ROOT}/errorClassIds.json`);

// const HTML_DIR_ROOT = `${CLASS101_HTML_ROOT}/classes`;
// const JSON_DIR_ROOT = `${CLASS101_JSON_ROOT}/classes`;

// for (const classId of errorClassIds){
//     const htmlDir = `${HTML_DIR_ROOT}/${classId}`;
//     const jsonFile = `${JSON_DIR_ROOT}/${classId}.json`;
//     if (fs.existsSync(htmlDir)){
//         console.log(`${classId} 삭제 예정`);
//         fs.rmdirSync(htmlDir, {
//             recursive: true
//         });
//         fs.unlinkSync(jsonFile);  // 파일 삭제
//     }
// }

// const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
// const unprocessedClasses = JSON.parse(JSON.stringify(myclasses));
// // const unprocessedClasses = myclasses.filter((c)=>!c.step.includes('S'));

// let errorLectures = [];

// for (const c of unprocessedClasses) {
//     console.log(c.classId);
//     const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${c.classId}.json`);
//     for (const l of lectures) {
//         if ('subtitles' in l) {
//             continue;
//         }
//         console.log(c.classId);
//         errorLectures.push({
//             classId: c.classId,
//             sn: l.sn,
//             lectureId: l.lectureId
//         });
//         saveJson(`${CLASS101_JSON_ROOT}/errorLectures.json`, errorLectures);
//         // console.log("=================================================")
//         // console.log(`자막 다운로드 중: ${c.title}  ${c.classId}/${l.sn}_${l.lectureId}`);
//         // console.log("-------------------------------------------------")
//         // await downloadLectureSubtitles(c.classId, l.lectureId);
//         // await sleepAsync(1000);
//     }

//     // // 원본 myclasses에서 해당 class를 찾아 업데이트
//     // const targetClass = myclasses.find((mc) => mc.classId === c.classId);
//     // if (targetClass) {
//     //     targetClass.step += 'S';
//     //     saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
//     // }
// }

// // * 중복된 강의 정보 재추출, 강의 자료 다운로드, 자막 다운로드
// // # main functions
// // step: 'L': 강의 정보 추출 완료, 'M': 강의 자료 다운로드 완료, 'V': 비디오 다운로드 완료, 'S': 자막 다운로드 완료
// const processOverlappedClasses = async ()=>{
//     const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
//     // step이 없는 경우 빈 문자열로 초기화
//     myclasses.forEach((c)=>{
//         if (!c.step) c.step = '';
//     });
//     // step: 'L': 강의 정보 추출 완료, 'M': 강의 자료 다운로드 완료, 'V': 비디오 다운로드 완료, 'S': 자막 다운로드 완료
//     const unprocessedClasses = myclasses.filter((c)=>!c.step.includes('L'));
//     for (const c of unprocessedClasses){
//         try {
//             console.log(`강의 정보 추출 중: ${c.classId}`);
//             await saveClassLectures(c.classId);
//             // 원본 myclasses에서 해당 class를 찾아 업데이트
//             const targetClass = myclasses.find((mc)=>mc.classId === c.classId);
//             if (targetClass) {
//                 targetClass.step += 'L';
//                 saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
//             }
//             await sleepAsync(5000);
//         } catch (error) {
//             console.error(`Error processing class ${c.classId}:`, error);
//             continue;
//         }
//     }
// };

// * TEST
findOverlappedClassIds(true);
findOverlappedLectures(true);
// findOverlappedHtmls(true);

// // * 실행
// findOverlappedLectures(true);
// findOverlappedHtmls(true);
// checkOverlappedHtmls(true);
// removeWrongHtmlFolders();
// correctClassJson();
