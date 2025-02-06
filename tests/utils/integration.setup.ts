// 통합 테스트를 위한 전역 설정
import dotenv from 'dotenv';

beforeAll(() => {
  // 환경 변수 로드
  dotenv.config();
  
  // 테스트용 데이터베이스 설정 등
});

afterAll(() => {
  // 테스트 데이터 정리
}); 