# 사용자 가이드
## JNU-Course: 온라인 강의 플랫폼 통합 라이브러리

### 📋 목차
1. [시작하기](#시작하기)
2. [설치 및 설정](#설치-및-설정)
3. [CLASS101 통합](#class101-통합)
4. [강의 데이터 수집](#강의-데이터-수집)
5. [카테고리 관리](#카테고리-관리)
6. [데이터 분석](#데이터-분석)
7. [고급 사용법](#고급-사용법)
8. [모범 사례](#모범-사례)
9. [문제해결](#문제해결)

---

## 🚀 시작하기

JNU-Course는 주요 온라인 강의 플랫폼을 위한 통합 TypeScript 인터페이스를 제공합니다:
- **CLASS101**: GraphQL API를 통한 강의 및 카테고리 데이터
- **Udemy**: REST API 통합 (계획됨)
- **Inflearn**: 웹 스크래핑 기반 데이터 수집 (계획됨)
- **FastCampus**: API 또는 스크래핑 통합 (계획됨)

### 빠른 시작
```typescript
import { fetchMainCategories, fetchProducts } from 'jnu-course';

// CLASS101 메인 카테고리 가져오기
const categories = await fetchMainCategories();
console.log('카테고리 수:', categories.length);

// 카테고리별 강의 제품 수집
const products = await fetchProducts(categories);
console.log('수집된 강의 수:', products.length);
```

---

## 📦 설치 및 설정

### 설치
```bash
npm install jnu-course
```

### 환경 구성
강의 플랫폼 설정으로 `.env` 파일을 생성하세요:

```bash
# CLASS101 설정
CLASS101_CATEGORY_URL=https://class101.net/ko/categories
CLASS101_JSON_ROOT=./data/class101
CLASS101_GRAPHQL_URL=https://class101.net/graphql

# Udemy 설정 (향후 지원)
UDEMY_CLIENT_ID=your-client-id
UDEMY_CLIENT_SECRET=your-client-secret
UDEMY_ACCESS_TOKEN=your-access-token

# Inflearn 설정 (향후 지원)
INFLEARN_BASE_URL=https://www.inflearn.com
INFLEARN_API_KEY=your-api-key

# 데이터 저장 경로
COURSE_DATA_ROOT=./course-data
```

### 디렉토리 구조 준비
```bash
# 데이터 저장 디렉토리 생성
mkdir -p ./data/class101
mkdir -p ./course-data/cache
```

### TypeScript 설정
```typescript
// types.d.ts
declare module 'jnu-course' {
  // 더 나은 IDE 지원을 위한 타입 임포트
}
```

---

## 🎨 CLASS101 통합

### CLASS101 기본 사용법
```typescript
import { 
  fetchMainCategories, 
  fetchSubCategories, 
  fetchProducts 
} from 'jnu-course';

// 1단계: 메인 카테고리 수집
const mainCategories = await fetchMainCategories();
console.log('메인 카테고리:');
mainCategories.forEach(cat => {
  console.log(`- ${cat.title} (ID: ${cat.categoryId})`);
});

// 2단계: 서브 카테고리 수집
const subCategories = await fetchSubCategories(mainCategories);
console.log(`서브 카테고리 수: ${subCategories.length}`);

// 3단계: 강의 제품 수집
const products = await fetchProducts(subCategories);
console.log(`수집된 강의 수: ${products.length}`);
```

### 특정 카테고리 강의 수집
```typescript
// 특정 카테고리의 강의만 수집
const designCategories = mainCategories.filter(cat => 
  cat.title.includes('디자인') || cat.title.includes('Design')
);

const designCourses = await fetchProducts(designCategories);
console.log('디자인 관련 강의:', designCourses.length);
```

---

## 📚 강의 데이터 수집

### 기본 강의 데이터 구조
```typescript
interface CLASS101Product {
  productId: string;      // 고유 제품 ID
  title: string;          // 강의 제목
  imageId: string;        // 커버 이미지 ID
  klassId: string;        // 클래스 ID
  likedCount: number;     // 좋아요 수
  firestoreId: string;    // Firestore 문서 ID
  categoryId: string;     // 카테고리 ID
  categoryTitle: string;  // 카테고리 이름
  authorId: string;       // 강사 ID
  authorName: string;     // 강사 이름
}
```

### 대량 데이터 수집
```typescript
class CLASS101DataCollector {
  private readonly DELAY_MS = 3000;  // 3초 대기
  
  async collectAllData(): Promise<void> {
    console.log('📋 1단계: 카테고리 수집 시작');
    const categories = await fetchMainCategories();
    
    console.log('📋 2단계: 서브 카테고리 수집 시작');
    const subCategories = await fetchSubCategories(categories);
    
    console.log('📋 3단계: 강의 제품 수집 시작');
    const products = await this.collectProductsWithProgress(subCategories);
    
    console.log(`✅ 수집 완료: ${products.length}개 강의`);
  }
  
  private async collectProductsWithProgress(categories: any[]): Promise<any[]> {
    const products: any[] = [];
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      console.log(`진행률: ${i + 1}/${categories.length} - ${category.title}`);
      
      try {
        const categoryProducts = await this.fetchCategoryProducts(category.categoryId);
        products.push(...categoryProducts);
        
        // 진행 상황 저장 (중간 백업)
        if ((i + 1) % 10 === 0) {
          await saveJson('products_backup.json', products);
        }
        
      } catch (error) {
        console.error(`카테고리 ${category.title} 수집 실패:`, error.message);
      }
      
      // 속도 제한 준수
      await sleepAsync(this.DELAY_MS);
    }
    
    return products;
  }
}
```

### 증분 업데이트
```typescript
class IncrementalUpdater {
  async updateCourseData(): Promise<void> {
    // 기존 데이터 로드
    const existingProducts = loadJson('products.json') || [];
    const lastUpdate = loadJson('last_update.json')?.timestamp || 0;
    
    // 최근 업데이트된 카테고리만 확인
    const categoriesToUpdate = await this.getUpdatedCategories(lastUpdate);
    
    for (const category of categoriesToUpdate) {
      const newProducts = await fetchCategoryProducts(category.categoryId);
      
      // 기존 데이터와 병합
      this.mergeProducts(existingProducts, newProducts);
    }
    
    // 업데이트 타임스탬프 저장
    await saveJson('last_update.json', { 
      timestamp: Date.now(),
      updated_categories: categoriesToUpdate.length 
    });
  }
  
  private mergeProducts(existing: any[], newProducts: any[]): void {
    newProducts.forEach(newProduct => {
      const existingIndex = existing.findIndex(p => p.productId === newProduct.productId);
      
      if (existingIndex >= 0) {
        // 기존 제품 업데이트
        existing[existingIndex] = { ...existing[existingIndex], ...newProduct };
      } else {
        // 새 제품 추가
        existing.push(newProduct);
      }
    });
  }
}
```

---

## 🗂️ 카테고리 관리

### 카테고리 계층 구조
```typescript
interface CategoryHierarchy {
  main: CLASS101Category[];
  sub: CLASS101Category[];
  mapping: Map<string, CLASS101Category[]>;
}

class CategoryManager {
  async buildHierarchy(): Promise<CategoryHierarchy> {
    const mainCategories = await fetchMainCategories();
    const subCategories = await fetchSubCategories(mainCategories);
    
    // 계층 구조 매핑 생성
    const mapping = new Map<string, CLASS101Category[]>();
    
    mainCategories.forEach(mainCat => {
      const relatedSubs = subCategories.filter(sub => 
        sub.parentId === mainCat.categoryId
      );
      mapping.set(mainCat.categoryId, relatedSubs);
    });
    
    return {
      main: mainCategories,
      sub: subCategories,
      mapping
    };
  }
  
  async getCategoryByName(name: string): Promise<CLASS101Category | null> {
    const allCategories = await this.getAllCategories();
    return allCategories.find(cat => 
      cat.title.toLowerCase().includes(name.toLowerCase())
    ) || null;
  }
  
  async getPopularCategories(limit = 10): Promise<CLASS101Category[]> {
    const categories = await this.getAllCategories();
    const products = loadJson('products.json') || [];
    
    // 카테고리별 강의 수 계산
    const categoryStats = new Map<string, number>();
    products.forEach(product => {
      const count = categoryStats.get(product.categoryId) || 0;
      categoryStats.set(product.categoryId, count + 1);
    });
    
    // 강의 수 기준으로 정렬
    return categories
      .sort((a, b) => 
        (categoryStats.get(b.categoryId) || 0) - (categoryStats.get(a.categoryId) || 0)
      )
      .slice(0, limit);
  }
}
```

---

## 📊 데이터 분석

### 강의 통계 분석
```typescript
class CourseAnalyzer {
  private products: CLASS101Product[];
  
  constructor(products: CLASS101Product[]) {
    this.products = products;
  }
  
  getBasicStats() {
    return {
      totalCourses: this.products.length,
      uniqueInstructors: new Set(this.products.map(p => p.authorId)).size,
      categories: new Set(this.products.map(p => p.categoryId)).size,
      averageLikes: this.products.reduce((sum, p) => sum + p.likedCount, 0) / this.products.length
    };
  }
  
  getTopInstructors(limit = 10) {
    const instructorStats = new Map<string, {
      name: string;
      courseCount: number;
      totalLikes: number;
    }>();
    
    this.products.forEach(product => {
      const existing = instructorStats.get(product.authorId) || {
        name: product.authorName,
        courseCount: 0,
        totalLikes: 0
      };
      
      existing.courseCount++;
      existing.totalLikes += product.likedCount;
      instructorStats.set(product.authorId, existing);
    });
    
    return Array.from(instructorStats.entries())
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, limit);
  }
  
  getCategoryAnalysis() {
    const categoryStats = new Map<string, {
      title: string;
      courseCount: number;
      averageLikes: number;
      topCourses: CLASS101Product[];
    }>();
    
    this.products.forEach(product => {
      const existing = categoryStats.get(product.categoryId) || {
        title: product.categoryTitle,
        courseCount: 0,
        averageLikes: 0,
        topCourses: []
      };
      
      existing.courseCount++;
      existing.topCourses.push(product);
      categoryStats.set(product.categoryId, existing);
    });
    
    // 카테고리별 평균 좋아요 수 계산
    categoryStats.forEach(stats => {
      stats.averageLikes = stats.topCourses.reduce(
        (sum, course) => sum + course.likedCount, 0
      ) / stats.courseCount;
      
      // 인기 강의 상위 5개만 유지
      stats.topCourses = stats.topCourses
        .sort((a, b) => b.likedCount - a.likedCount)
        .slice(0, 5);
    });
    
    return Array.from(categoryStats.entries()).map(([id, stats]) => ({
      categoryId: id,
      ...stats
    }));
  }
}

// 사용법
const products = loadJson('products.json');
const analyzer = new CourseAnalyzer(products);

console.log('기본 통계:', analyzer.getBasicStats());
console.log('인기 강사:', analyzer.getTopInstructors(5));
console.log('카테고리 분석:', analyzer.getCategoryAnalysis());
```

### 강의 검색 및 필터링
```typescript
class CourseSearchEngine {
  private products: CLASS101Product[];
  
  constructor(products: CLASS101Product[]) {
    this.products = products;
  }
  
  searchByKeyword(keyword: string): CLASS101Product[] {
    const lowercaseKeyword = keyword.toLowerCase();
    
    return this.products.filter(product =>
      product.title.toLowerCase().includes(lowercaseKeyword) ||
      product.authorName.toLowerCase().includes(lowercaseKeyword) ||
      product.categoryTitle.toLowerCase().includes(lowercaseKeyword)
    );
  }
  
  filterByCategory(categoryTitle: string): CLASS101Product[] {
    return this.products.filter(product =>
      product.categoryTitle.toLowerCase().includes(categoryTitle.toLowerCase())
    );
  }
  
  filterByPopularity(minLikes: number): CLASS101Product[] {
    return this.products
      .filter(product => product.likedCount >= minLikes)
      .sort((a, b) => b.likedCount - a.likedCount);
  }
  
  filterByInstructor(authorName: string): CLASS101Product[] {
    return this.products.filter(product =>
      product.authorName.toLowerCase().includes(authorName.toLowerCase())
    );
  }
  
  getRecommendations(userInterests: string[], limit = 10): CLASS101Product[] {
    const scores = new Map<string, number>();
    
    // 관심사 기반 점수 계산
    this.products.forEach(product => {
      let score = 0;
      
      userInterests.forEach(interest => {
        if (product.title.toLowerCase().includes(interest.toLowerCase())) {
          score += 3;
        }
        if (product.categoryTitle.toLowerCase().includes(interest.toLowerCase())) {
          score += 2;
        }
      });
      
      // 인기도 가중치 추가
      score += Math.log(product.likedCount + 1);
      
      scores.set(product.productId, score);
    });
    
    return this.products
      .sort((a, b) => (scores.get(b.productId) || 0) - (scores.get(a.productId) || 0))
      .slice(0, limit);
  }
}

// 사용법
const searchEngine = new CourseSearchEngine(products);

// 키워드 검색
const programmingCourses = searchEngine.searchByKeyword('프로그래밍');

// 카테고리 필터링
const designCourses = searchEngine.filterByCategory('디자인');

// 인기 강의 필터링
const popularCourses = searchEngine.filterByPopularity(100);

// 추천 강의
const recommendations = searchEngine.getRecommendations(['React', 'TypeScript', '웹개발']);
```

---

## 🛠️ 고급 사용법

### 데이터 수집 자동화
```typescript
class AutomatedCollector {
  private config: CollectionConfig;
  
  constructor(config: CollectionConfig) {
    this.config = config;
  }
  
  async runDailyCollection(): Promise<void> {
    console.log('🔄 일일 데이터 수집 시작');
    
    try {
      // 1. 기존 데이터 백업
      await this.backupExistingData();
      
      // 2. 새로운 카테고리 확인
      const categories = await fetchMainCategories();
      const newCategories = await this.detectNewCategories(categories);
      
      if (newCategories.length > 0) {
        console.log(`🆕 새로운 카테고리 ${newCategories.length}개 발견`);
      }
      
      // 3. 강의 데이터 수집
      const products = await fetchProducts(categories, true);
      
      // 4. 데이터 품질 검사
      const qualityReport = await this.validateDataQuality(products);
      console.log('품질 보고서:', qualityReport);
      
      // 5. 완료 알림
      console.log(`✅ 수집 완료: ${products.length}개 강의`);
      
    } catch (error) {
      console.error('❌ 수집 실패:', error.message);
      await this.sendErrorNotification(error);
    }
  }
  
  private async validateDataQuality(products: any[]): Promise<QualityReport> {
    const report = {
      totalProducts: products.length,
      missingImages: 0,
      missingAuthors: 0,
      duplicates: 0,
      validProducts: 0
    };
    
    const seenIds = new Set<string>();
    
    products.forEach(product => {
      // 중복 검사
      if (seenIds.has(product.productId)) {
        report.duplicates++;
        return;
      }
      seenIds.add(product.productId);
      
      // 필수 필드 검사
      if (!product.imageId) report.missingImages++;
      if (!product.authorName) report.missingAuthors++;
      
      // 유효한 제품 카운트
      if (product.title && product.productId && product.authorName) {
        report.validProducts++;
      }
    });
    
    return report;
  }
}

interface CollectionConfig {
  platforms: string[];
  scheduleInterval: number;
  backupEnabled: boolean;
  notificationWebhook?: string;
}
```

### 멀티 플랫폼 데이터 통합 (향후 구현)
```typescript
class MultiPlatformCourseManager {
  private platforms: Map<string, any> = new Map();
  
  addPlatform(name: string, client: any) {
    this.platforms.set(name, client);
  }
  
  async collectFromAllPlatforms(): Promise<StandardCourse[]> {
    const allCourses: StandardCourse[] = [];
    
    for (const [platformName, client] of this.platforms) {
      try {
        console.log(`📡 ${platformName} 데이터 수집 중...`);
        const courses = await this.collectFromPlatform(platformName, client);
        
        // 플랫폼별 데이터를 표준 형식으로 변환
        const standardizedCourses = courses.map(course => 
          this.standardizeCourseData(course, platformName)
        );
        
        allCourses.push(...standardizedCourses);
        console.log(`✅ ${platformName}: ${standardizedCourses.length}개 강의 수집`);
        
      } catch (error) {
        console.error(`❌ ${platformName} 수집 실패:`, error.message);
      }
    }
    
    return this.deduplicateCourses(allCourses);
  }
  
  private standardizeCourseData(rawCourse: any, platform: string): StandardCourse {
    // 플랫폼별 데이터를 표준 형식으로 변환
    switch (platform) {
      case 'class101':
        return this.convertFromCLASS101(rawCourse);
      case 'udemy':
        return this.convertFromUdemy(rawCourse);
      default:
        throw new Error(`지원되지 않는 플랫폼: ${platform}`);
    }
  }
}
```

---

## 📈 강의 트렌드 분석

### 인기 트렌드 분석
```typescript
class TrendAnalyzer {
  analyzePopularityTrends(products: CLASS101Product[], timeframe = 30): TrendReport {
    // 좋아요 수 기준 트렌드 분석
    const sortedByLikes = products
      .sort((a, b) => b.likedCount - a.likedCount)
      .slice(0, 50);
    
    // 카테고리별 인기도
    const categoryTrends = this.analyzeCategoryTrends(products);
    
    // 강사별 성과
    const instructorTrends = this.analyzeInstructorTrends(products);
    
    return {
      topCourses: sortedByLikes.slice(0, 10),
      trendingCategories: categoryTrends.slice(0, 5),
      risingInstructors: instructorTrends.slice(0, 5),
      insights: this.generateInsights(sortedByLikes, categoryTrends)
    };
  }
  
  private analyzeCategoryTrends(products: CLASS101Product[]) {
    const categoryMap = new Map<string, {
      title: string;
      courseCount: number;
      totalLikes: number;
      averageLikes: number;
      growth: number;
    }>();
    
    products.forEach(product => {
      const existing = categoryMap.get(product.categoryId) || {
        title: product.categoryTitle,
        courseCount: 0,
        totalLikes: 0,
        averageLikes: 0,
        growth: 0
      };
      
      existing.courseCount++;
      existing.totalLikes += product.likedCount;
      categoryMap.set(product.categoryId, existing);
    });
    
    // 평균 계산 및 성장률 추정
    categoryMap.forEach(stats => {
      stats.averageLikes = stats.totalLikes / stats.courseCount;
      // 성장률은 좋아요 수와 강의 수의 조합으로 계산
      stats.growth = stats.averageLikes * Math.log(stats.courseCount + 1);
    });
    
    return Array.from(categoryMap.entries())
      .map(([id, stats]) => ({ categoryId: id, ...stats }))
      .sort((a, b) => b.growth - a.growth);
  }
}
```

### 경쟁 분석 도구
```typescript
class CompetitiveAnalyzer {
  async compareInstructors(instructorIds: string[]): Promise<InstructorComparison[]> {
    const products = loadJson('products.json');
    const comparisons: InstructorComparison[] = [];
    
    instructorIds.forEach(instructorId => {
      const instructorCourses = products.filter(p => p.authorId === instructorId);
      
      if (instructorCourses.length > 0) {
        const analysis = {
          instructorId,
          name: instructorCourses[0].authorName,
          courseCount: instructorCourses.length,
          totalLikes: instructorCourses.reduce((sum, c) => sum + c.likedCount, 0),
          averageLikes: 0,
          categories: [...new Set(instructorCourses.map(c => c.categoryTitle))],
          topCourse: instructorCourses.sort((a, b) => b.likedCount - a.likedCount)[0]
        };
        
        analysis.averageLikes = analysis.totalLikes / analysis.courseCount;
        comparisons.push(analysis);
      }
    });
    
    return comparisons.sort((a, b) => b.averageLikes - a.averageLikes);
  }
  
  async findSimilarCourses(targetCourse: CLASS101Product, limit = 5): Promise<CLASS101Product[]> {
    const products = loadJson('products.json');
    
    return products
      .filter(p => p.productId !== targetCourse.productId)
      .map(course => ({
        ...course,
        similarity: this.calculateSimilarity(targetCourse, course)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  private calculateSimilarity(course1: CLASS101Product, course2: CLASS101Product): number {
    let score = 0;
    
    // 같은 카테고리
    if (course1.categoryId === course2.categoryId) score += 0.5;
    
    // 같은 강사
    if (course1.authorId === course2.authorId) score += 0.3;
    
    // 제목 유사도 (간단한 키워드 매칭)
    const keywords1 = course1.title.toLowerCase().split(' ');
    const keywords2 = course2.title.toLowerCase().split(' ');
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    score += (commonKeywords.length / Math.max(keywords1.length, keywords2.length)) * 0.2;
    
    return score;
  }
}
```

---

## ✅ 모범 사례

### 데이터 수집 최적화
```typescript
// 효율적인 데이터 수집을 위한 모범 사례
class OptimizedCollector {
  async collectWithRateLimit(categories: any[]): Promise<any[]> {
    const products: any[] = [];
    const batchSize = 10;  // 배치 크기
    
    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      
      // 배치 내에서는 순차 처리 (속도 제한 준수)
      for (const category of batch) {
        try {
          const categoryProducts = await fetchCategoryProducts(category.categoryId);
          products.push(...this.extractProducts(categoryProducts));
          
          // 카테고리 간 지연
          await sleepAsync(3000);
          
        } catch (error) {
          console.warn(`카테고리 ${category.title} 스킵:`, error.message);
        }
      }
      
      // 배치 완료 후 저장
      await saveJson('products_progress.json', products);
      console.log(`진행률: ${Math.min(i + batchSize, categories.length)}/${categories.length}`);
    }
    
    return products;
  }
  
  private extractProducts(response: any): any[] {
    if (!response?.data?.categoryProductsV3?.edges) {
      return [];
    }
    
    return response.data.categoryProductsV3.edges.map(edge => {
      const node = edge.node;
      return {
        productId: node._id,
        title: node.title,
        imageId: this.extractImageId(node.coverImageUrl),
        klassId: node.klassId,
        likedCount: node.likedCount || 0,
        firestoreId: node.firestoreId,
        categoryId: node.category.id,
        categoryTitle: node.category.title,
        authorId: node.author._id,
        authorName: node.author.displayName,
      };
    });
  }
  
  private extractImageId(imageUrl: string): string {
    try {
      return imageUrl.split('/').pop()?.split('.')[0] || '';
    } catch (error) {
      return '';
    }
  }
}
```

### 오류 처리 및 복구
```typescript
async function robustDataCollection() {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      console.log(`시도 ${attempt + 1}/${maxRetries}`);
      
      const categories = await fetchMainCategories();
      const products = await fetchProducts(categories);
      
      // 데이터 품질 검증
      if (products.length < 100) {
        throw new Error('수집된 데이터가 너무 적습니다');
      }
      
      console.log('✅ 데이터 수집 성공');
      return products;
      
    } catch (error) {
      console.error(`❌ 시도 ${attempt + 1} 실패:`, error.message);
      attempt++;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 5000; // 지수 백오프
        console.log(`⏳ ${delay}ms 후 재시도...`);
        await sleepAsync(delay);
      }
    }
  }
  
  throw new Error(`${maxRetries}번의 시도 후 데이터 수집 실패`);
}
```

### 데이터 내보내기
```typescript
class DataExporter {
  async exportToCSV(products: CLASS101Product[], filename: string): Promise<void> {
    const csvHeaders = [
      'Product ID', 'Title', 'Category', 'Author', 
      'Liked Count', 'Klass ID', 'Image ID'
    ];
    
    const csvRows = products.map(product => [
      product.productId,
      `"${product.title.replace(/"/g, '""')}"`,  // CSV 이스케이핑
      `"${product.categoryTitle}"`,
      `"${product.authorName}"`,
      product.likedCount,
      product.klassId,
      product.imageId
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    const fs = await import('fs/promises');
    await fs.writeFile(filename, csvContent, 'utf-8');
    console.log(`📁 CSV 파일 저장됨: ${filename}`);
  }
  
  async exportToJSON(products: CLASS101Product[], filename: string): Promise<void> {
    const exportData = {
      timestamp: new Date().toISOString(),
      platform: 'CLASS101',
      total_courses: products.length,
      courses: products
    };
    
    await saveJson(filename, exportData);
    console.log(`📁 JSON 파일 저장됨: ${filename}`);
  }
}

// 사용법
const exporter = new DataExporter();
const products = loadJson('products.json');

await exporter.exportToCSV(products, 'class101_courses.csv');
await exporter.exportToJSON(products, 'class101_export.json');
```

---

## 🔧 문제해결

### 일반적인 문제

#### GraphQL 쿼리 실패
```typescript
async function troubleshootGraphQL() {
  const testQuery = {
    operationName: 'Test',
    variables: { test: true },
    query: 'query Test { __typename }'
  };
  
  try {
    const response = await fetch(process.env.CLASS101_GRAPHQL_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testQuery)
    });
    
    if (response.ok) {
      console.log('✅ GraphQL 엔드포인트가 정상입니다');
    } else {
      console.error('❌ GraphQL 응답 오류:', response.status);
    }
  } catch (error) {
    console.error('❌ GraphQL 연결 실패:', error.message);
  }
}
```

#### 속도 제한 문제
```typescript
class RateLimitHandler {
  private lastRequestTime = 0;
  private requestInterval = 3000; // 3초
  
  async withRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestInterval) {
      const waitTime = this.requestInterval - timeSinceLastRequest;
      console.log(`⏳ 속도 제한 준수: ${waitTime}ms 대기 중...`);
      await sleepAsync(waitTime);
    }
    
    this.lastRequestTime = Date.now();
    return await operation();
  }
}

// 사용법
const rateLimitHandler = new RateLimitHandler();

const products = await rateLimitHandler.withRateLimit(() =>
  fetchCategoryProducts(categoryId)
);
```

#### 데이터 무결성 검사
```typescript
function validateProductData(products: CLASS101Product[]): ValidationReport {
  const report: ValidationReport = {
    valid: 0,
    invalid: 0,
    duplicates: 0,
    missing_fields: [],
    errors: []
  };
  
  const seenIds = new Set<string>();
  
  products.forEach((product, index) => {
    // 중복 검사
    if (seenIds.has(product.productId)) {
      report.duplicates++;
      report.errors.push(`중복 ID: ${product.productId} (인덱스: ${index})`);
      return;
    }
    seenIds.add(product.productId);
    
    // 필수 필드 검사
    const requiredFields = ['productId', 'title', 'authorName', 'categoryTitle'];
    const missingFields = requiredFields.filter(field => !product[field]);
    
    if (missingFields.length > 0) {
      report.invalid++;
      report.missing_fields.push(`${product.productId}: ${missingFields.join(', ')}`);
    } else {
      report.valid++;
    }
  });
  
  return report;
}
```

### 디버그 모드
```typescript
// 디버그 로깅 활성화
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(operation: string, data?: any) {
  if (DEBUG) {
    console.log(`[DEBUG:Course] ${operation}`, data || '');
  }
}

// GraphQL 요청 디버깅
async function debugGraphQLRequest(query: any) {
  debugLog('GraphQL 요청 시작', { 
    operation: query.operationName,
    variables: query.variables 
  });
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(CLASS101_GRAPHQL_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    
    const duration = Date.now() - startTime;
    debugLog('GraphQL 응답 받음', { 
      status: response.status,
      duration_ms: duration 
    });
    
    return await response.json();
  } catch (error) {
    debugLog('GraphQL 요청 실패', { error: error.message });
    throw error;
  }
}
```

---

*최종 업데이트: 2025-08-30*  
*버전: 1.0*