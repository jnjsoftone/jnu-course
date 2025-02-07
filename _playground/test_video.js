// & video
// // # video
// const downloadVideo = async (classId, lectureId) => {
//   try {
//     const classInfo = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
//     const lecture = classInfo.find((l) => l.lectureId === lectureId);

//     // Python 스크립트 실행
//     const pythonProcess = spawn('python', [
//       'BE/class101/python/recorder.py',
//       '--url',
//       `https://class101.net/ko/classes/${classId}/lectures/${lectureId}`,
//       '--duration',
//       '300', // 임시 duration 값
//     ]);

//     // Python 프로세스의 출력 처리
//     pythonProcess.stdout.on('data', (data) => {
//       console.log(`Python Output: ${data}`);
//     });

//     pythonProcess.stderr.on('data', (data) => {
//       console.error(`Python Error: ${data}`);
//     });

//     // 프로세스 종료 대기
//     return new Promise((resolve, reject) => {
//       pythonProcess.on('close', (code) => {
//         if (code === 0) {
//           resolve(true);
//         } else {
//           reject(new Error(`Python process exited with code ${code}`));
//         }
//       });
//     });
//   } catch (error) {
//     console.error('비디오 다운로드 중 오류 발생:', error);
//     throw error;
//   }
// };
