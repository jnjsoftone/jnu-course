import { loadJson, loadFile, saveJson, saveFile, setPath, findFiles, findFolders, sanitizeName } from 'jnu-abc';
// const { loadJson, loadFile, saveJson, saveFile, findFolders } = require('jnu-abc');

CLASS101_JSON_ROOT = '/volume1/video/lecture/_repo3/class101/json';
CLASS101_HTML_ROOT = '/volume1/video/lecture/_repo3/class101/html';
CLASS101_VIDEO_ROOT = '/volume1/video/lecture/class101_3';

// CLASS101_JSON_ROOT = '/volume1/video/lecture/_repo/class101/json';
// CLASS101_HTML_ROOT = '/volume1/video/lecture/_repo/class101/html';
// CLASS101_VIDEO_ROOT = '/volume1/video/lecture/class101_2';

// const CLASS101_JSON_ROOT = 'C:/JnJ/Developments/Utils/nodejs/jnu-course/data/class101/json';
// const CLASS101_HTML_ROOT = 'C:/JnJ/Developments/Utils/nodejs/jnu-course/data/class101/html';
// const CLASS101_VIDEO_ROOT = 'C:/JnJ/Developments/Utils/nodejs/jnu-course/data/class101/video';

const substituteTitle = (title) => {
  let result = title.includes(':')
    ? title
        .split(':')[0]
        .trim()
        .replace(/(.+?)[\d]+$/, '$1')
    : title;

  result = result
    .replace(/미션첨부파일$/, '')
    .replace(/첨부파일$/, '')
    .replace(/미션$/, '')
    .trim();

  return result;
};

/**
 * 중복 제목 일련번호 추가
 * 644a1e39b4d9d018091a3fc1.json의의 "연습문제 " 와 같이 뒷쪽에 숫자가 없어진 일련번호(1, 2, 3, ) 추가
 * @param {string[]} titles - 제목 배열
 * @returns {string[]} 일련번호가 추가된 제목 배열
 */
const attachSerialNumber = (titles) => {
  const result = [];
  let prevTitle = '';
  let serialNumber = 1;

  for (let i = 0; i < titles.length; i++) {
    const currentTitle = titles[i];

    // 이전 제목과 현재 제목이 같은 경우
    if (currentTitle === prevTitle) {
      serialNumber++;
      result.push(`${currentTitle} ${serialNumber}`);
    }
    // 이전 제목과 현재 제목이 다른 경우
    else {
      // 다음 제목이 현재 제목과 같은지 확인
      const nextTitle = titles[i + 1];

      // 다음 제목이 현재 제목과 같다면 일련번호 시작
      if (nextTitle === currentTitle) {
        serialNumber = 1;
        result.push(`${currentTitle} ${serialNumber}`);
      }
      // 다음 제목이 다르다면 원래 제목 유지
      else {
        result.push(currentTitle);
        serialNumber = 1;
      }
      prevTitle = currentTitle;
    }
  }

  return result;
};

/*
 * 자막 파일 이동
 * @param classId: 강의 번호
 * @param lectureId: 강의 번호
 * @param vttInfos: 자막 정보
 * @return void
 */
const copyVttFilesToVideo = (classId) => {
  const folders = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
  const classInfo = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);

  for (const folder of folders) {
    console.log(`folder: ${folder}`);
    const lectureSlug = folder.split('/').pop();
    const lectureSn = parseInt(lectureSlug.split('_')[0]);
    const lecture = classInfo.find((l) => l.sn === lectureSn);
    const lectureVtt = classInfo.find((l) => l.sn === lectureSn).subtitles.find((v) => v.lang === 'ko');
    // console.log(`lectureVtt: ${JSON.stringify(lectureVtt)}`);
    if (lectureVtt) {
      const vttName = lectureVtt.name;
      const src = `${CLASS101_HTML_ROOT}/classes/${classId}/${lectureSlug}/subtitles/${vttName}`;
      console.log(`@@@src: ${src} dst:${CLASS101_VIDEO_ROOT}/${classId}/${lectureSlug}.vtt`);
      saveFile(`${CLASS101_VIDEO_ROOT}/${classId}/${lectureSlug}.vtt`, loadFile(src), {
        newFile: false,
      });
    } else {
      console.log(`자막 파일을 찾을 수 없습니다: ${classId}/${lectureSlug}`);
    }
  }
};

// // * 자막 파일 복사
// // const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses_2.json`);
// // const classeIds = myclasses.map((c) => c.classId);
// const classeIds = ['5c514d81d30c532c44694761'];
// for (const classId of classeIds) {
//   // const classId = myclass.lectures.map((l) => l.sn);
//   copyVttFilesToVideo(classId);
// }

// * 제목 변경
const classIds = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`).map((c) => c.classId);
// const classIds = ['644a1e39b4d9d018091a3fc1'];

for (const classId of classIds) {
  const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  let titles = [];
  for (const lecture of lectures) {
    lecture.title = substituteTitle(lecture.title);
    titles.push(lecture.title);
  }

  //* 중복 제목 일련번호 추가
  titles = attachSerialNumber(titles);

  lectures.forEach((lecture, index) => {
    lecture.title = titles[index];
  });

  await saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
}
