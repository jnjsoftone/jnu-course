// E2E 테스트를 위한 전역 설정
import dotenv from 'dotenv';

beforeAll(async () => {
  // 환경 변수 로드
  dotenv.config();
  
  // 테스트 환경 설정
  // 예: 브라우저 설정, API 서버 시작 등
});

afterAll(async () => {
  // 리소스 정리
  // 예: 브라우저 종료, 서버 종료 등
}); 