# 기술 요구사항 정의서
## JNU-Course: 온라인 강의 플랫폼 통합 라이브러리

### 📋 문서 정보
- **문서 유형**: 기술 요구사항 정의서 (TRD)
- **버전**: 1.0
- **최종 업데이트**: 2025-08-30
- **대상 독자**: 개발자, 아키텍트, DevOps 엔지니어

---

## 1. 시스템 아키텍처

### 1.1 전체 시스템 구조
```
JNU-Course Library
├── Platform Integration Layer
│   ├── CLASS101 GraphQL Client
│   ├── Udemy REST Client (planned)
│   ├── Inflearn Scraper (planned)
│   └── FastCampus Client (planned)
├── Data Processing Layer
│   ├── Course Data Normalizer
│   ├── Category Mapper
│   ├── Price Converter
│   └── Rating Aggregator
├── Web Scraping Layer
│   ├── Chrome Automation
│   ├── Content Parser
│   ├── Anti-Detection System
│   └── Rate Limiting Manager
├── Abstraction Layer
│   ├── Unified Course Interface
│   ├── Search Engine
│   └── Filter System
└── Utility Layer
    ├── Configuration Manager
    ├── Cache System
    └── Logging Framework
```

### 1.2 모듈 설계

#### CLASS101 통합 모듈 (`src/class101/`)
- **목적**: CLASS101 GraphQL API 클라이언트 구현
- **책임**: 카테고리, 강의, 강사, 영상 데이터 수집
- **기술**: GraphQL 쿼리, persisted queries

#### 웹 스크래핑 모듈 (`src/*/utils/`)
- **목적**: API가 없는 플랫폼의 웹 스크래핑
- **책임**: Chrome 자동화, 콘텐츠 파싱, 안티 디텍션
- **의존성**: jnu-web (Chrome 자동화), jnu-abc (유틸리티)

#### 데이터 처리 모듈 (`src/types.ts`)
- **목적**: 플랫폼별 데이터를 표준 형식으로 변환
- **책임**: 데이터 정규화, 타입 정의, 검증

---

## 2. CLASS101 통합 세부사항

### 2.1 GraphQL API 아키텍처

#### 인증 및 연결
- **엔드포인트**: `https://class101.net/graphql`
- **인증**: 공개 GraphQL 엔드포인트 (인증 불필요)
- **프로토콜**: HTTPS POST 요청
- **헤더**: `Content-Type: application/json`

#### Persisted Queries 시스템
```typescript
interface PersistedQuery {
  version: number;
  sha256Hash: string;
}

// CLASS101 카테고리 쿼리
const CATEGORY_QUERY_HASH = 'de9123f7372649c2874c9939436d6c5417a48b55af12045b7bdaea7de0a079cc';
```

### 2.2 데이터 수집 파이프라인

#### 카테고리 수집 흐름
```
GraphQL 카테고리 쿼리
    ↓
메인 카테고리 파싱
    ↓
서브 카테고리 재귀 수집
    ↓
카테고리 계층 구조 생성
    ↓
JSON 파일 저장
```

#### 강의 수집 흐름
```
카테고리 ID 입력
    ↓
GraphQL 강의 쿼리 (1000개씩)
    ↓
커서 기반 페이지네이션
    ↓
강의 데이터 정규화
    ↓
중복 제거 및 병합
    ↓
JSON 파일 저장
```

### 2.3 GraphQL 쿼리 구조

#### 카테고리 쿼리
```graphql
query CategoryProductsV3OnCategoryProductList(
  $filter: ProductFilter!
  $categoryId: ID!
  $first: Int!
  $after: String
  $sort: ProductSort!
  $isLoggedIn: Boolean!
  $originalLanguages: [OriginalLanguage!]!
) {
  categoryProductsV3(
    filter: $filter
    categoryId: $categoryId
    first: $first
    after: $after
    sort: $sort
    isLoggedIn: $isLoggedIn
    originalLanguages: $originalLanguages
  ) {
    edges {
      node {
        _id
        title
        klassId
        coverImageUrl
        likedCount
        firestoreId
        author {
          _id
          displayName
        }
        category {
          id
          title
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## 3. 데이터 모델 및 타입

### 3.1 표준화된 강의 데이터 모델

#### Course 인터페이스 (계획됨)
```typescript
interface StandardCourse {
  // 기본 정보
  id: string;
  platform: 'class101' | 'udemy' | 'inflearn' | 'fastcampus';
  title: string;
  description: string;
  url: string;
  
  // 강사 정보
  instructor: {
    id: string;
    name: string;
    avatar?: string;
    bio?: string;
  };
  
  // 분류 정보
  category: {
    main: string;
    sub: string;
    tags: string[];
  };
  
  // 가격 정보
  pricing: {
    currency: string;
    original_price: number;
    current_price: number;
    discount_percentage?: number;
    is_free: boolean;
  };
  
  // 평가 정보
  rating: {
    score: number;
    count: number;
    reviews?: number;
  };
  
  // 콘텐츠 정보
  content: {
    duration_minutes?: number;
    lesson_count?: number;
    level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
  };
  
  // 메타데이터
  metadata: {
    created_at: string;
    updated_at: string;
    popularity_score?: number;
    completion_rate?: number;
  };
}
```

### 3.2 CLASS101 특화 데이터 모델

#### CLASS101Product 인터페이스
```typescript
interface CLASS101Product {
  productId: string;        // 고유 제품 ID
  title: string;           // 강의 제목
  imageId: string;         // 커버 이미지 ID
  klassId: string;         // 클래스 ID
  likedCount: number;      // 좋아요 수
  firestoreId: string;     // Firestore 문서 ID
  categoryId: string;      // 카테고리 ID
  categoryTitle: string;   // 카테고리 이름
  authorId: string;        // 강사 ID
  authorName: string;      // 강사 이름
}
```

#### CLASS101Category 인터페이스
```typescript
interface CLASS101Category {
  categoryId: string;
  title: string;
  parentId?: string;
  depth: number;
  children?: CLASS101Category[];
}
```

---

## 4. 데이터 수집 및 처리

### 4.1 속도 제한 관리

#### 요청 제한 전략
```typescript
interface RateLimitConfig {
  requestsPerMinute: number;
  burstSize: number;
  cooldownPeriod: number;
  backoffMultiplier: number;
}

// CLASS101 기본 설정
const class101RateLimit: RateLimitConfig = {
  requestsPerMinute: 20,
  burstSize: 5,
  cooldownPeriod: 3000,     // 3초
  backoffMultiplier: 2.0
};
```

#### 요청 스케줄링
- **순차 처리**: 카테고리별 순차 수집
- **지연 삽입**: 요청 간 3초 대기
- **오류 시 백오프**: 실패 시 지수적 대기 시간 증가
- **연결 풀링**: HTTP 연결 재사용

### 4.2 데이터 저장 및 관리

#### 파일 시스템 구조
```
{CLASS101_JSON_ROOT}/
├── mainCategories.json      # 메인 카테고리 목록
├── subCategories.json       # 서브 카테고리 목록
├── products.json           # 전체 강의 제품 데이터
├── courses/
│   ├── {categoryId}.json   # 카테고리별 강의 목록
│   └── details/
│       └── {courseId}.json # 강의 상세 정보
└── cache/
    ├── graphql_responses/  # GraphQL 응답 캐시
    └── images/            # 이미지 메타데이터
```

#### 데이터 무결성
```typescript
interface DataValidation {
  validateCourse(course: any): ValidationResult;
  validateCategory(category: any): ValidationResult;
  deduplicateProducts(products: any[]): any[];
  normalizeData(rawData: any, platform: string): StandardCourse;
}
```

---

## 5. 웹 스크래핑 아키텍처

### 5.1 Chrome 자동화 시스템

#### Chrome 구성
```typescript
const chromeOptions = {
  arguments: [
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-extensions',
    '--start-maximized',
    '--window-size=1920,1080',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  ]
};
```

#### 안티 디텍션 전략
- **User-Agent 로테이션**: 다양한 브라우저 시뮬레이션
- **요청 간격**: 인간과 유사한 패턴
- **쿠키 관리**: 세션 지속성 유지
- **자바스크립트 실행**: 동적 콘텐츠 로딩 대기

### 5.2 콘텐츠 파싱 시스템

#### HTML 파싱 아키텍처
```typescript
interface ContentParser {
  parseCourseList(html: string): CoursePreview[];
  parseCourseDetail(html: string): CourseDetail;
  parseInstructorProfile(html: string): InstructorProfile;
  extractMetadata(html: string): CourseMetadata;
}
```

#### 데이터 추출 전략
- **CSS 선택자**: 안정적인 DOM 요소 선택
- **XPath**: 복잡한 구조의 데이터 추출
- **정규 표현식**: 텍스트 패턴 매칭
- **JSON-LD**: 구조화된 데이터 추출

---

## 6. 성능 및 확장성

### 6.1 성능 최적화 전략

#### 병렬 처리
```typescript
interface ConcurrencyConfig {
  maxConcurrentRequests: number;    // 최대 동시 요청 (기본값: 5)
  requestQueue: boolean;           // 요청 대기열 사용
  retryStrategy: 'exponential' | 'linear' | 'fixed';
  maxRetries: number;              // 최대 재시도 횟수
}
```

#### 캐싱 시스템
```typescript
interface CacheStrategy {
  level: 'memory' | 'file' | 'database';
  ttl: number;                     // 캐시 수명 (초)
  maxSize: number;                 // 최대 캐시 크기
  compression: boolean;            // 압축 사용 여부
}
```

### 6.2 메모리 및 리소스 관리
- **스트리밍**: 대용량 데이터 스트림 처리
- **청킹**: 큰 데이터셋을 작은 단위로 분할
- **가비지 컬렉션**: 처리 후 메모리 해제
- **리소스 모니터링**: CPU, 메모리 사용량 추적

### 6.3 확장성 설계
- **무상태**: 서비스 클라이언트는 상태를 유지하지 않음
- **수평 확장**: 여러 인스턴스에서 독립적 실행
- **부하 분산**: 여러 수집 작업자 간 부하 분산

---

## 7. 오류 처리 및 복구

### 7.1 오류 분류 시스템
```typescript
enum CourseErrorType {
  NETWORK = 'network',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  ACCESS_DENIED = 'access_denied',
  DATA_CORRUPTION = 'data_corruption'
}

interface CourseError {
  platform: string;
  type: CourseErrorType;
  message: string;
  code?: string | number;
  retryable: boolean;
  context?: {
    categoryId?: string;
    courseId?: string;
    url?: string;
    operation?: string;
  };
  originalError?: Error;
}
```

### 7.2 복구 전략

#### GraphQL 오류 처리
- **네트워크 오류**: 지수 백오프 재시도
- **쿼리 오류**: 쿼리 구문 검증 및 수정
- **속도 제한**: 대기 시간 증가 및 재시도
- **서버 오류**: 대체 엔드포인트 또는 캐시 사용

#### 스크래핑 오류 처리
- **페이지 로딩 실패**: 재로딩 및 대기 시간 증가
- **요소 미발견**: 대체 선택자 시도
- **디텍션 감지**: User-Agent 변경 및 세션 재시작
- **CAPTCHA**: 수동 개입 또는 우회 전략

---

## 8. 데이터 수집 워크플로우

### 8.1 CLASS101 데이터 수집

#### 카테고리 수집 프로세스
```typescript
async function collectCategories(): Promise<CLASS101Category[]> {
  // 1. 메인 카테고리 수집
  const mainCategories = await fetchMainCategories();
  
  // 2. 각 메인 카테고리의 서브 카테고리 수집
  const allCategories: CLASS101Category[] = [];
  
  for (const mainCategory of mainCategories) {
    const subCategories = await fetchSubCategories(mainCategory.id);
    allCategories.push(mainCategory, ...subCategories);
    
    // 속도 제한 준수
    await sleepAsync(3000);
  }
  
  // 3. 계층 구조 생성 및 저장
  const hierarchicalCategories = buildCategoryHierarchy(allCategories);
  await saveJson('categories.json', hierarchicalCategories);
  
  return hierarchicalCategories;
}
```

#### 강의 수집 프로세스
```typescript
async function collectCourses(categories: CLASS101Category[]): Promise<CLASS101Product[]> {
  const allProducts: CLASS101Product[] = [];
  
  for (const category of categories) {
    let cursor = null;
    let hasNextPage = true;
    
    while (hasNextPage) {
      // GraphQL 쿼리 실행
      const response = await fetchCategoryProducts(category.categoryId, cursor);
      
      // 응답 데이터 처리
      const products = response.data.categoryProductsV3.edges.map(edge => 
        normalizeProductData(edge.node)
      );
      
      // 중복 제거 후 추가
      products.forEach(product => {
        if (!allProducts.find(p => p.productId === product.productId)) {
          allProducts.push(product);
        }
      });
      
      // 페이지네이션 처리
      const pageInfo = response.data.categoryProductsV3.pageInfo;
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;
      
      // 속도 제한 준수
      await sleepAsync(3000);
    }
    
    // 진행 상황 저장
    await saveJson('products.json', allProducts);
  }
  
  return allProducts;
}
```

---

## 9. 환경 구성 및 설정

### 9.1 환경 변수 관리
```bash
# CLASS101 설정
CLASS101_CATEGORY_URL=https://class101.net/ko/categories
CLASS101_JSON_ROOT=./data/class101
CLASS101_GRAPHQL_URL=https://class101.net/graphql

# Udemy 설정 (향후)
UDEMY_CLIENT_ID=your-client-id
UDEMY_CLIENT_SECRET=your-client-secret
UDEMY_ACCESS_TOKEN=your-access-token

# 스크래핑 설정
CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
```

### 9.2 플랫폼별 구성
```typescript
interface PlatformConfig {
  class101: {
    graphqlUrl: string;
    categoryUrl: string;
    jsonRoot: string;
    rateLimit: RateLimitConfig;
  };
  udemy: {
    apiUrl: string;
    clientId: string;
    clientSecret: string;
  };
  inflearn: {
    baseUrl: string;
    scraping: ScrapingConfig;
  };
}
```

---

## 10. 모니터링 및 로깅

### 10.1 로깅 시스템
```typescript
interface CourseLogEntry {
  timestamp: string;
  platform: string;
  operation: string;
  category_id?: string;
  course_count?: number;
  success: boolean;
  duration_ms: number;
  error?: string;
  metadata?: Record<string, any>;
}
```

### 10.2 성능 메트릭
- **수집 속도**: 시간당 수집된 강의 수
- **성공률**: 성공적인 수집 비율
- **응답 시간**: API 호출 평균 응답 시간
- **오류율**: 오류 타입별 발생 빈도
- **데이터 품질**: 누락 필드 및 검증 실패율

### 10.3 건상성 체크
```typescript
async function healthCheck(): Promise<PlatformHealth> {
  const health: PlatformHealth = {};
  
  // CLASS101 GraphQL 엔드포인트 확인
  try {
    const testQuery = await fetchCategoryProducts('test', null);
    health.class101 = {
      status: 'healthy',
      response_time_ms: Date.now() - startTime
    };
  } catch (error) {
    health.class101 = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  return health;
}
```

---

## 11. 보안 및 컴플라이언스

### 11.1 데이터 수집 윤리
- **robots.txt 준수**: 웹사이트의 로봇 배제 표준 확인
- **속도 제한**: 서버에 과부하를 주지 않는 합리적인 속도
- **사용 약관**: 각 플랫폼의 API 사용 약관 준수
- **개인정보 보호**: 개인 식별 정보 수집 금지

### 11.2 데이터 보안
```typescript
interface SecurityConfig {
  encryptSensitiveData: boolean;
  anonymizeUserData: boolean;
  auditLogging: boolean;
  accessControl: {
    readOnly: boolean;
    allowedOperations: string[];
  };
}
```

### 11.3 에러 처리 보안
- **민감한 정보 로깅 금지**: API 키, 개인정보 로그 제외
- **안전한 오류 메시지**: 내부 구현 세부사항 노출 방지
- **감사 추적**: 중요한 작업에 대한 로그 기록

---

## 12. 배포 및 운영

### 12.1 빌드 시스템
- **컴파일러**: SWC (고속 TypeScript 컴파일)
- **출력 형식**: CommonJS, ES Modules, TypeScript 선언 파일
- **번들 크기**: 최적화된 크기 (<1MB)
- **의존성**: 트리 셰이킹으로 미사용 코드 제거

### 12.2 배포 전략
```bash
# 빌드 및 테스트
npm run build
npm run test:coverage

# 패키지 배포
npm publish
```

### 12.3 운영 모니터링
- **수집 상태**: 실시간 데이터 수집 상태 모니터링
- **오류 알림**: 수집 실패 시 즉시 알림
- **성능 추적**: 수집 속도 및 품질 메트릭
- **용량 관리**: 데이터 저장 공간 모니터링

---

*문서 버전: 1.0*  
*최종 업데이트: 2025-08-30*  
*다음 검토: 2025-09-30*