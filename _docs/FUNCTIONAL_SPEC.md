# 기능 명세서
## JNU-Course: 온라인 강의 플랫폼 통합 라이브러리

### 📋 문서 정보
- **문서 유형**: 기능 명세서
- **버전**: 1.0
- **최종 업데이트**: 2025-08-30
- **대상 독자**: 개발자, 통합 엔지니어, API 소비자

---

## 1. 개요 및 범위

### 1.1 라이브러리 목적
JNU-Course는 CLASS101, Udemy, Inflearn, FastCampus를 포함한 주요 온라인 강의 플랫폼과 통합하기 위한 통합 TypeScript 인터페이스를 제공합니다. 플랫폼 간 타입 안전성과 일관된 데이터 처리를 유지하면서 플랫폼별 구현 세부 사항을 추상화합니다.

### 1.2 지원 플랫폼
- **CLASS101**: GraphQL API를 통한 강의 및 카테고리 데이터
- **Udemy**: REST API 통합 (계획됨)
- **Inflearn**: 웹 스크래핑 기반 데이터 수집 (계획됨)
- **FastCampus**: API 또는 스크래핑 통합 (계획됨)
- **Coursera**: 공개 API 통합 (계획됨)

### 1.3 통합 패턴
- **통합 데이터 모델**: 플랫폼 간 일관된 강의 데이터 구조
- **타입 안전성**: 모든 작업에 대한 완전한 TypeScript 정의
- **자동화**: 대량 데이터 수집 및 처리 자동화
- **확장성**: 새로운 플랫폼 쉽게 추가 가능한 아키텍처

---

## 2. CLASS101 통합 모듈

### 2.1 카테고리 관리 함수

#### 2.1.1 함수: `fetchMainCategories(): Promise<CLASS101Category[]>`
**목적**: CLASS101의 메인 카테고리 목록을 가져옵니다.

**입력 명세**:
- 매개변수 없음 (환경 변수에서 구성 로드)

**출력 명세**:
- 반환값 `Promise<CLASS101Category[]>` - 메인 카테고리 배열
- 각 카테고리에는 ID, 제목, 계층 정보 포함

**CLASS101Category 인터페이스**:
```typescript
interface CLASS101Category {
  categoryId: string;     // 고유 카테고리 ID
  title: string;         // 카테고리 이름
  parentId?: string;     // 부모 카테고리 ID (서브 카테고리인 경우)
  depth: number;         // 계층 깊이 (0: 메인, 1: 서브)
  children?: CLASS101Category[];  // 하위 카테고리 배열
}
```

**동작**:
- CLASS101 GraphQL API에 카테고리 쿼리 전송
- 응답 데이터에서 메인 카테고리 추출
- 카테고리 계층 구조 생성
- JSON 파일로 결과 저장 (선택적)

**오류 처리**:
- 네트워크 오류: 자동 재시도 (최대 3회)
- GraphQL 오류: 쿼리 구문 검증 및 로깅
- 파싱 오류: 데이터 구조 검증 및 기본값 제공

#### 2.1.2 함수: `fetchSubCategories(mainCategories: CLASS101Category[]): Promise<CLASS101Category[]>`
**목적**: 메인 카테고리들의 서브 카테고리를 모두 수집합니다.

**입력 명세**:
- `mainCategories: CLASS101Category[]` - 메인 카테고리 배열

**출력 명세**:
- 반환값 `Promise<CLASS101Category[]>` - 모든 서브 카테고리 배열
- 메인 카테고리와 동일한 데이터 구조
- 부모-자식 관계 정보 포함

**동작**:
- 각 메인 카테고리에 대해 GraphQL 쿼리 실행
- 서브 카테고리 데이터 추출 및 정규화
- 부모 카테고리 ID 연결
- 속도 제한 준수 (3초 간격)

### 2.2 강의 데이터 수집 함수

#### 2.2.1 함수: `fetchCategoryProducts(categoryId: string, cursor?: string): Promise<GraphQLResponse>`
**목적**: 특정 카테고리의 강의 제품 목록을 GraphQL로 조회합니다.

**입력 명세**:
- `categoryId: string` - 대상 카테고리 ID
- `cursor?: string` - 페이지네이션을 위한 커서 (선택적)

**출력 명세**:
- 반환값 `Promise<GraphQLResponse>` - CLASS101 GraphQL API 응답
- 강의 제품 배열과 페이지네이션 정보 포함

**GraphQLResponse 구조**:
```typescript
interface GraphQLResponse {
  data: {
    categoryProductsV3: {
      edges: Array<{
        node: {
          _id: string;
          title: string;
          klassId: string;
          coverImageUrl: string;
          likedCount: number;
          firestoreId: string;
          author: {
            _id: string;
            displayName: string;
          };
          category: {
            id: string;
            title: string;
          };
        };
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}
```

**동작**:
- GraphQL Persisted Query 사용으로 최적화된 요청
- 카테고리별 최대 1000개 제품 조회
- 커서 기반 페이지네이션 지원
- 구매 옵션 필터링 (Lifetime, Rental, Subscription)

**GraphQL 쿼리 매개변수**:
```typescript
const queryVariables = {
  filter: {
    purchaseOptions: ['Lifetime', 'Rental', 'Subscription']
  },
  categoryId: categoryId,
  first: 1000,
  isLoggedIn: true,
  sort: 'Popular',
  originalLanguages: [],
  after: cursor || undefined
};
```

#### 2.2.2 함수: `fetchProducts(subCategories?: CLASS101Category[], save?: boolean): Promise<CLASS101Product[]>`
**목적**: 여러 카테고리의 모든 강의 제품을 수집합니다.

**입력 명세**:
- `subCategories?: CLASS101Category[]` - 대상 카테고리 배열 (선택적, 기본값: 저장된 카테고리)
- `save?: boolean` - 수집 중간 결과 저장 여부 (기본값: true)

**출력 명세**:
- 반환값 `Promise<CLASS101Product[]>` - 수집된 모든 강의 제품 배열
- 중복 제거된 고유 제품 목록
- 카테고리 및 강사 정보 포함

**CLASS101Product 인터페이스**:
```typescript
interface CLASS101Product {
  productId: string;        // 고유 제품 ID
  title: string;           // 강의 제목
  imageId: string;         // 커버 이미지 ID (URL에서 추출)
  klassId: string;         // 클래스 고유 ID
  likedCount: number;      // 좋아요 수 (인기도 지표)
  firestoreId: string;     // Firestore 문서 ID
  categoryId: string;      // 소속 카테고리 ID
  categoryTitle: string;   // 카테고리 이름
  authorId: string;        // 강사 고유 ID
  authorName: string;      // 강사 표시 이름
}
```

**동작**:
- 각 카테고리에 대해 순차적으로 `fetchCategoryProducts` 호출
- GraphQL 응답에서 제품 데이터 추출 및 정규화
- 이미지 URL에서 이미지 ID 추출
- 중복 제품 자동 제거 (productId 기준)
- 속도 제한 준수 (카테고리 간 3초 대기)
- 진행 중간 결과 자동 저장 (save=true인 경우)

**데이터 변환 로직**:
```typescript
const normalizeProductData = (node: any): CLASS101Product => {
  // 이미지 ID 추출
  let imageId = '';
  try {
    imageId = node.coverImageUrl.split('/').pop().split('.')[0];
  } catch (error) {
    console.log(`이미지 ID 추출 실패: ${node.title}, ${node._id}`);
  }
  
  return {
    productId: node._id,
    title: node.title,
    imageId: imageId,
    klassId: node.klassId,
    likedCount: node.likedCount || 0,
    firestoreId: node.firestoreId,
    categoryId: node.category.id,
    categoryTitle: node.category.title,
    authorId: node.author._id,
    authorName: node.author.displayName,
  };
};
```

**중복 제거 메커니즘**:
- 수집 과정에서 실시간 중복 검사
- `productId`를 기준으로 중복 판단
- 중복 발견 시 기존 항목 유지, 새 항목 무시
- 중복 제거 로그 출력

---

## 3. 유틸리티 함수

### 3.1 Chrome 자동화 유틸리티 (계획됨)

#### 3.1.1 함수: `initializeChromeForScraping(options?: ChromeOptions): Promise<ChromeInstance>`
**목적**: 웹 스크래핑을 위한 Chrome 브라우저 인스턴스를 초기화합니다.

**입력 명세**:
- `options?: ChromeOptions` - Chrome 실행 옵션

**ChromeOptions 인터페이스**:
```typescript
interface ChromeOptions {
  headless?: boolean;           // 헤드리스 모드 (기본값: true)
  userAgent?: string;          // 사용자 에이전트 문자열
  viewport?: {                 // 뷰포트 크기
    width: number;
    height: number;
  };
  timeout?: number;            // 페이지 로딩 타임아웃
  antiDetection?: boolean;     // 안티 디텍션 기능 활성화
}
```

**출력 명세**:
- 반환값 `Promise<ChromeInstance>` - 구성된 Chrome 브라우저 인스턴스
- 웹 스크래핑에 최적화된 설정 적용
- 자동 스크롤 및 동적 콘텐츠 로딩 지원

### 3.2 데이터 파싱 유틸리티 (계획됨)

#### 3.2.1 함수: `parseCoursePage(html: string, platform: string): Promise<CourseDetail>`
**목적**: 강의 상세 페이지 HTML을 파싱하여 구조화된 데이터를 추출합니다.

**입력 명세**:
- `html: string` - 강의 페이지의 HTML 콘텐츠
- `platform: string` - 대상 플랫폼 ('class101', 'udemy', 'inflearn')

**출력 명세**:
- 반환값 `Promise<CourseDetail>` - 파싱된 강의 상세 정보

**CourseDetail 인터페이스**:
```typescript
interface CourseDetail {
  id: string;
  title: string;
  description: string;
  instructor: {
    id: string;
    name: string;
    bio?: string;
    avatar?: string;
  };
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    discountRate?: number;
  };
  content: {
    duration?: string;
    lessonCount?: number;
    level?: string;
    prerequisites?: string[];
  };
  rating: {
    score: number;
    count: number;
    distribution?: Record<number, number>;
  };
  metadata: {
    publishDate?: string;
    updateDate?: string;
    language: string;
    tags: string[];
  };
}
```

---

## 4. 데이터 수집 및 관리

### 4.1 자동화된 수집 워크플로우

#### 4.1.1 함수: `collectAllData(platforms?: string[]): Promise<CollectionResult>`
**목적**: 지정된 플랫폼에서 모든 강의 데이터를 자동으로 수집합니다.

**입력 명세**:
- `platforms?: string[]` - 수집할 플랫폼 목록 (기본값: ['class101'])

**출력 명세**:
- 반환값 `Promise<CollectionResult>` - 수집 결과 및 통계

**CollectionResult 인터페이스**:
```typescript
interface CollectionResult {
  success: boolean;
  platforms: Record<string, PlatformResult>;
  summary: {
    totalCourses: number;
    totalCategories: number;
    totalInstructors: number;
    collectionTime: number;  // 밀리초
  };
  errors: CollectionError[];
}

interface PlatformResult {
  platform: string;
  coursesCollected: number;
  categoriesFound: number;
  errors: number;
  duration: number;
}
```

**동작**:
- 플랫폼별 병렬 또는 순차 수집
- 진행 상황 실시간 로깅
- 중간 결과 자동 백업
- 오류 발생 시 자동 복구 시도
- 최종 품질 검증 및 보고서 생성

### 4.2 증분 업데이트 시스템

#### 4.2.1 함수: `updateCourseData(config: UpdateConfig): Promise<UpdateResult>`
**목적**: 기존 데이터를 기반으로 변경된 강의 정보만 업데이트합니다.

**입력 명세**:
- `config: UpdateConfig` - 업데이트 구성 옵션

**UpdateConfig 인터페이스**:
```typescript
interface UpdateConfig {
  platforms: string[];           // 업데이트할 플랫폼
  checkInterval: number;         // 마지막 업데이트 이후 시간 (시간)
  forceUpdate?: boolean;         // 강제 전체 업데이트
  categories?: string[];         // 특정 카테고리만 업데이트
  batchSize?: number;           // 배치 처리 크기
}
```

**출력 명세**:
- 반환값 `Promise<UpdateResult>` - 업데이트 결과 및 변경 사항

**UpdateResult 인터페이스**:
```typescript
interface UpdateResult {
  success: boolean;
  changes: {
    added: number;        // 새로 추가된 강의 수
    updated: number;      // 업데이트된 강의 수
    removed: number;      // 제거된 강의 수
  };
  duration: number;       // 업데이트 소요 시간
  nextUpdate: string;     // 다음 업데이트 권장 시간
}
```

---

## 5. 검색 및 필터링 시스템

### 5.1 강의 검색 함수

#### 5.1.1 함수: `searchCourses(query: SearchQuery): Promise<SearchResult>`
**목적**: 다양한 조건으로 강의를 검색하고 필터링합니다.

**입력 명세**:
- `query: SearchQuery` - 검색 조건 및 필터

**SearchQuery 인터페이스**:
```typescript
interface SearchQuery {
  keyword?: string;              // 검색 키워드
  platforms?: string[];          // 대상 플랫폼 배열
  categories?: string[];         // 카테고리 필터
  instructors?: string[];        // 강사 필터
  minLikes?: number;            // 최소 좋아요 수
  maxLikes?: number;            // 최대 좋아요 수
  sortBy?: 'popularity' | 'title' | 'date' | 'likes';
  sortOrder?: 'asc' | 'desc';
  limit?: number;               // 결과 개수 제한
  offset?: number;              // 결과 시작 위치
}
```

**출력 명세**:
- 반환값 `Promise<SearchResult>` - 검색 결과 및 메타데이터

**SearchResult 인터페이스**:
```typescript
interface SearchResult {
  courses: CLASS101Product[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filters: {
    appliedFilters: Record<string, any>;
    availableFilters: {
      categories: string[];
      instructors: string[];
      likesRange: [number, number];
    };
  };
  searchTime: number;           // 검색 소요 시간 (밀리초)
}
```

**동작**:
- 로컬 저장된 강의 데이터에서 검색 수행
- 키워드는 제목, 강사명, 카테고리에서 검색
- 다중 필터 조건 지원 (AND 조건)
- 정렬 및 페이지네이션 적용
- 검색 성능 최적화 (인덱싱)

### 5.2 고급 필터링 함수

#### 5.2.1 함수: `getRecommendations(userProfile: UserProfile, limit?: number): Promise<CLASS101Product[]>`
**목적**: 사용자 프로필을 기반으로 맞춤형 강의를 추천합니다.

**입력 명세**:
- `userProfile: UserProfile` - 사용자 관심사 및 선호도
- `limit?: number` - 추천 결과 개수 (기본값: 10)

**UserProfile 인터페이스**:
```typescript
interface UserProfile {
  interests: string[];          // 관심 키워드 배열
  preferredCategories: string[]; // 선호 카테고리
  experience: 'beginner' | 'intermediate' | 'advanced';
  completedCourses?: string[];  // 완료한 강의 ID
  likedInstructors?: string[];  // 선호 강사 ID
}
```

**동작**:
- 관심사와 강의 제목/카테고리 매칭
- 선호 카테고리 가중치 적용
- 인기도 (좋아요 수) 고려
- 완료한 강의 제외
- 다양성 확보 (같은 강사/카테고리 제한)

**추천 알고리즘**:
```typescript
const calculateRecommendationScore = (
  course: CLASS101Product, 
  profile: UserProfile
): number => {
  let score = 0;
  
  // 관심사 매칭 (높은 가중치)
  profile.interests.forEach(interest => {
    if (course.title.toLowerCase().includes(interest.toLowerCase())) {
      score += 3;
    }
    if (course.categoryTitle.toLowerCase().includes(interest.toLowerCase())) {
      score += 2;
    }
  });
  
  // 선호 카테고리 매칭
  if (profile.preferredCategories.includes(course.categoryId)) {
    score += 2;
  }
  
  // 선호 강사 매칭
  if (profile.likedInstructors?.includes(course.authorId)) {
    score += 1.5;
  }
  
  // 인기도 가중치 (로그 스케일)
  score += Math.log(course.likedCount + 1) * 0.1;
  
  return score;
};
```

---

## 6. 데이터 분석 및 통계

### 6.1 통계 분석 함수

#### 6.1.1 함수: `analyzeCourseStatistics(products?: CLASS101Product[]): Promise<CourseStatistics>`
**목적**: 수집된 강의 데이터의 다양한 통계를 분석합니다.

**입력 명세**:
- `products?: CLASS101Product[]` - 분석할 강의 배열 (기본값: 저장된 데이터)

**출력 명세**:
- 반환값 `Promise<CourseStatistics>` - 종합적인 통계 분석 결과

**CourseStatistics 인터페이스**:
```typescript
interface CourseStatistics {
  overview: {
    totalCourses: number;
    totalInstructors: number;
    totalCategories: number;
    averageLikes: number;
    medianLikes: number;
  };
  categories: CategoryAnalysis[];
  instructors: InstructorAnalysis[];
  trends: TrendAnalysis;
  insights: string[];
}

interface CategoryAnalysis {
  categoryId: string;
  title: string;
  courseCount: number;
  averageLikes: number;
  topCourses: CLASS101Product[];
  marketShare: number;          // 전체 강의 중 비율
}

interface InstructorAnalysis {
  authorId: string;
  name: string;
  courseCount: number;
  totalLikes: number;
  averageLikes: number;
  categories: string[];         // 강의하는 카테고리들
  consistency: number;          // 강의 품질 일관성 점수
}
```

**동작**:
- 기본 통계 계산 (평균, 중앙값, 분포)
- 카테고리별 상세 분석
- 강사별 성과 분석
- 트렌드 패턴 식별
- 인사이트 및 권장사항 생성

### 6.2 시장 분석 함수

#### 6.2.1 함수: `analyzeMarketTrends(timeframe?: number): Promise<MarketTrends>`
**목적**: 시장 트렌드와 성장 패턴을 분석합니다.

**입력 명세**:
- `timeframe?: number` - 분석 기간 (일 단위, 기본값: 90일)

**MarketTrends 인터페이스**:
```typescript
interface MarketTrends {
  growingCategories: CategoryGrowth[];
  decliningCategories: CategoryGrowth[];
  emergingInstructors: InstructorGrowth[];
  marketConcentration: {
    herfindahlIndex: number;    // 시장 집중도 지수
    topCategories: CategoryAnalysis[];
  };
  seasonality: SeasonalPattern[];
}

interface CategoryGrowth {
  categoryId: string;
  title: string;
  growthRate: number;           // 성장률 (%)
  newCourses: number;           // 신규 강의 수
  averageQuality: number;       // 평균 품질 점수
}
```

---

## 7. 오류 처리 및 복구

### 7.1 표준화된 오류 응답

#### 7.1.1 CourseError 인터페이스
```typescript
interface CourseError {
  platform: 'class101' | 'udemy' | 'inflearn' | 'fastcampus';
  type: 'network' | 'parsing' | 'validation' | 'rate_limit' | 'auth';
  message: string;
  code?: string | number;
  retryable: boolean;
  context?: {
    categoryId?: string;
    courseId?: string;
    operation?: string;
    url?: string;
  };
  originalError?: Error;
}
```

**오류 범주**:
- **network**: 연결 실패, 타임아웃, DNS 문제
- **parsing**: 데이터 파싱 실패, 구조 변경
- **validation**: 잘못된 데이터, 필수 필드 누락
- **rate_limit**: API 속도 제한 초과
- **auth**: 인증 실패, 권한 부족

### 7.2 CLASS101 특화 오류 처리

#### GraphQL 오류 코드
- **400 Bad Request**: 잘못된 GraphQL 쿼리 구문
- **429 Too Many Requests**: 속도 제한 초과
- **500 Internal Server Error**: GraphQL 서버 오류
- **Network Error**: 연결 실패 또는 타임아웃

#### 자동 복구 메커니즘
```typescript
async function robustGraphQLRequest(
  query: any, 
  maxRetries = 3
): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(CLASS101_GRAPHQL_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // GraphQL 오류 검사
      if (data.errors) {
        throw new Error(`GraphQL Error: ${data.errors[0].message}`);
      }
      
      return data;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`시도 ${attempt}/${maxRetries} 실패:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 지수 백오프
        console.log(`${delay}ms 후 재시도...`);
        await sleepAsync(delay);
      }
    }
  }
  
  throw new CourseError({
    platform: 'class101',
    type: 'network',
    message: `${maxRetries}번의 시도 후 GraphQL 요청 실패`,
    retryable: true,
    originalError: lastError!
  });
}
```

---

## 8. 성능 최적화

### 8.1 속도 제한 관리

#### 8.1.1 함수: `withRateLimit<T>(operation: () => Promise<T>, platform: string): Promise<T>`
**목적**: 플랫폼별 속도 제한을 준수하며 작업을 실행합니다.

**플랫폼별 속도 제한**:
```typescript
const RATE_LIMITS = {
  class101: {
    requestsPerMinute: 20,
    minInterval: 3000,     // 3초
    burstSize: 5
  },
  udemy: {
    requestsPerMinute: 100,
    minInterval: 600,      // 0.6초
    burstSize: 10
  },
  inflearn: {
    requestsPerMinute: 30,
    minInterval: 2000,     // 2초 (스크래핑)
    burstSize: 3
  }
};
```

### 8.2 캐싱 시스템

#### 8.2.1 함수: `cacheData(key: string, data: any, ttl?: number): Promise<void>`
**목적**: 수집된 데이터를 효율적으로 캐싱합니다.

**캐싱 전략**:
- **메모리 캐시**: 자주 접근하는 데이터 (카테고리, 인기 강의)
- **파일 캐시**: 대용량 데이터 (전체 강의 목록)
- **TTL 관리**: 데이터 신선도 유지
- **압축**: 저장 공간 최적화

### 8.3 병렬 처리 최적화

#### 배치 처리 시스템
```typescript
class BatchProcessor {
  private concurrencyLimit = 5;
  
  async processCategoriesInBatches(
    categories: CLASS101Category[]
  ): Promise<CLASS101Product[]> {
    const results: CLASS101Product[] = [];
    const batches = this.createBatches(categories, this.concurrencyLimit);
    
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(category => 
          this.processSingleCategory(category)
        )
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          console.error('배치 처리 오류:', result.reason);
        }
      });
      
      // 배치 간 지연
      await sleepAsync(1000);
    }
    
    return results;
  }
  
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

---

## 9. 데이터 품질 및 검증

### 9.1 데이터 검증 시스템

#### 9.1.1 함수: `validateCourseData(products: CLASS101Product[]): Promise<ValidationReport>`
**목적**: 수집된 강의 데이터의 품질을 검증합니다.

**검증 규칙**:
```typescript
interface ValidationRules {
  required_fields: string[];    // 필수 필드 목록
  field_types: Record<string, string>;  // 필드 타입 검증
  value_ranges: Record<string, [number, number]>;  // 값 범위 검증
  format_patterns: Record<string, RegExp>;  // 형식 패턴 검증
}

const courseValidationRules: ValidationRules = {
  required_fields: ['productId', 'title', 'authorName', 'categoryTitle'],
  field_types: {
    productId: 'string',
    likedCount: 'number',
    klassId: 'string'
  },
  value_ranges: {
    likedCount: [0, 100000]
  },
  format_patterns: {
    productId: /^[a-f0-9]{24}$/i  // MongoDB ObjectId 패턴
  }
};
```

### 9.2 데이터 정제 시스템

#### 9.2.1 함수: `cleanAndNormalizeData(rawProducts: any[]): Promise<CLASS101Product[]>`
**목적**: 원시 데이터를 정제하고 정규화합니다.

**정제 작업**:
- **제목 정제**: HTML 태그 제거, 특수 문자 정규화
- **숫자 검증**: 좋아요 수 등 숫자 필드 검증
- **ID 형식**: 일관된 ID 형식으로 변환
- **중복 제거**: 동일한 강의의 중복 항목 제거

```typescript
const normalizeProduct = (rawProduct: any): CLASS101Product => {
  return {
    productId: rawProduct.productId || rawProduct._id,
    title: sanitizeTitle(rawProduct.title),
    imageId: extractImageId(rawProduct.coverImageUrl || rawProduct.imageUrl),
    klassId: rawProduct.klassId || rawProduct.classId,
    likedCount: Math.max(0, parseInt(rawProduct.likedCount) || 0),
    firestoreId: rawProduct.firestoreId || '',
    categoryId: rawProduct.categoryId || rawProduct.category?.id,
    categoryTitle: rawProduct.categoryTitle || rawProduct.category?.title,
    authorId: rawProduct.authorId || rawProduct.author?._id,
    authorName: sanitizeName(rawProduct.authorName || rawProduct.author?.displayName),
  };
};
```

---

## 10. 확장성 및 플러그인 시스템

### 10.1 플랫폼 플러그인 인터페이스

#### 10.1.1 새로운 플랫폼 추가
```typescript
interface CoursePlatformPlugin {
  name: string;
  version: string;
  
  // 필수 메서드
  initialize(config: any): Promise<void>;
  getCategories(): Promise<Category[]>;
  getCourses(categoryId: string): Promise<Course[]>;
  getCourseDetail(courseId: string): Promise<CourseDetail>;
  
  // 선택적 메서드
  searchCourses?(query: string): Promise<Course[]>;
  getInstructorCourses?(instructorId: string): Promise<Course[]>;
  getRatings?(courseId: string): Promise<Rating[]>;
}
```

### 10.2 데이터 변환 시스템
```typescript
interface DataTransformer {
  // 플랫폼별 데이터를 표준 형식으로 변환
  transformToStandard(rawData: any, platform: string): StandardCourse;
  
  // 표준 형식을 플랫폼별 형식으로 변환
  transformFromStandard(standardData: StandardCourse, platform: string): any;
  
  // 데이터 품질 검증
  validateTransformation(original: any, transformed: any): boolean;
}
```

---

*문서 버전: 1.0*  
*최종 업데이트: 2025-08-30*  
*다음 검토: 2025-09-30*