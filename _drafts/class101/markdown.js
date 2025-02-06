import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import TurndownService from 'turndown';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MarkdownGenerator {
  constructor() {
    // 프로젝트 루트 디렉토리 설정
    const projectRoot = path.join(__dirname, '..', '..', '..');

    this.MARKDOWN_ROOT_DIR = path.join(
      projectRoot,
      '_repo',
      'class101',
      'markdown'
    );
    this.JSON_ROOT_DIR = path.join(projectRoot, '_repo', 'class101', 'json');
    this.HTML_ROOT_DIR = path.join(projectRoot, '_repo', 'class101', 'html');

    // 디렉토리 존재 확인 및 생성
    this.ensureDirectories();

    // TurndownService 초기화
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-',
      hr: '---',
      escapeCharacters: [],
    });

    // 강조 표시 처리를 위한 규칙 추가
    this.turndownService.addRule('emphasis', {
      filter: ['strong', 'b'],
      replacement: function (content, node, options) {
        return `**${content}** `;
      },
    });

    // 숫자 목록 처리를 위한 규칙 추가 (기존 규칙 덮어쓰기)
    this.turndownService.addRule('orderedList', {
      filter: 'ol',
      replacement: function (content, node) {
        const items = content.trim().split('\n');
        return items
          .map((item, index) => `${index + 1}. ${item.trim()}`)
          .join('\n\n');
      },
    });

    // 숫자로 시작하는 줄의 이스케이프 문자 제거를 위한 규칙 추가
    this.turndownService.addRule('numberedLine', {
      filter: ['p', 'div'],
      replacement: function (content, node) {
        // 숫자로 시작하고 점(.)이 있는 텍스트의 이스케이프 문자 제거
        return content.replace(/(\d+)\\\./g, '$1.');
      },
    });

    // 이미지 처리를 위한 규칙 추가
    this.turndownService.addRule('images', {
      filter: ['img'],
      replacement: function (content, node) {
        const alt = node.alt || '';
        const src = node.getAttribute('src') || '';
        return `![${alt}](${src})`;
      },
    });
  }

  ensureDirectories() {
    const dirs = [
      this.MARKDOWN_ROOT_DIR,
      this.JSON_ROOT_DIR,
      this.HTML_ROOT_DIR,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        // console.log(`Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  sanitizeName(name) {
    return name
      .replace(/[[\]]/g, '')
      .replace(/[^\uAC00-\uD7A3a-zA-Z0-9_\(\)\<\>\,\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getLectureSlug(lecture) {
    return `${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`;
  }

  getCategory(classId, categories) {
    // console.log.log('\n=== getCategory ===');

    try {
      // myclasses.json에서 classId에 해당하는 categoryId 찾기
      const myclassesPath = path.join(this.JSON_ROOT_DIR, 'myclasses.json');
      const myclasses = JSON.parse(fs.readFileSync(myclassesPath, 'utf8'));
      const classInfo = myclasses.find((c) => c.classId === classId);
      if (!classInfo) {
        // console.log.log('Class not found in myclasses.json');
        return '';
      }
      // console.log.log('Found class categoryId:', classInfo.categoryId);

      // subCategories.json에서 categoryId와 일치하는 subCategory 찾기
      const subCategoriesPath = path.join(
        this.JSON_ROOT_DIR,
        'subCategories.json'
      );
      const subCategories = JSON.parse(
        fs.readFileSync(subCategoriesPath, 'utf8')
      );
      const subCategory = subCategories.find(
        (sc) => sc.categoryId === classInfo.categoryId
      );
      if (!subCategory) {
        // console.log.log('SubCategory not found');
        return '';
      }
      // console.log.log('Found subCategory:', subCategory);

      // categories.json에서 ancestorId와 categoryId가 일치하는 category 찾기
      const categoriesPath = path.join(this.JSON_ROOT_DIR, 'categories.json');
      const categoriesData = JSON.parse(
        fs.readFileSync(categoriesPath, 'utf8')
      );
      const category = categoriesData.find(
        (c) => c.categoryId === subCategory.ancestorId
      );
      if (!category) {
        // console.log.log('Category not found');
        return '';
      }
      // console.log.log('Found category:', category);

      // 카테고리 문자열 생성
      const result = `${category.title0}/${category.title}/${subCategory.title}`;
      // console.log.log('Result:', result);
      return result;
    } catch (error) {
      // console.log.error('Error in getCategory:', error);
      return '';
    }
  }

  async generateMarkdown(classId) {
    try {
      // console.log('Reading JSON files...');

      const myclassesPath = path.join(this.JSON_ROOT_DIR, 'myclasses.json');
      const categoriesPath = path.join(this.JSON_ROOT_DIR, 'categories.json');
      const classInfoPath = path.join(
        this.JSON_ROOT_DIR,
        'classes',
        `${classId}.json`
      );

      // console.log(`Checking files:...`);

      const classesJson = JSON.parse(fs.readFileSync(myclassesPath, 'utf8'));
      // console.log('myclasses.json content:', ...);

      const categoriesJson = JSON.parse(
        fs.readFileSync(categoriesPath, 'utf8')
      );
      // console.log('categories.json content:', ...);

      const classInfo = JSON.parse(fs.readFileSync(classInfoPath, 'utf8'));
      // console.log('classInfo content:', ...);

      const lectures = Array.isArray(classInfo)
        ? classInfo
        : classInfo.lectures;

      // console.log(`Found ${lectures?.length || 0} lectures in class info`);

      const classData = classesJson.find((c) => c.classId === classId);
      if (!classData) {
        throw new Error(`Class ID ${classId} not found in myclasses.json`);
      }
      // console.log('Found class data:', classData);

      const classTitle = this.sanitizeName(classData.title);
      const category = this.getCategory(classId, categoriesJson);
      // console.log('Final category:', category);

      // 클래스 폴더 생성
      const classDir = path.join(this.MARKDOWN_ROOT_DIR, classTitle);
      // console.log(`Creating class directory: ${classDir}`);
      if (!fs.existsSync(classDir)) {
        fs.mkdirSync(classDir, { recursive: true });
      }

      // 각 강의별 마크다운 생성
      for (const lecture of lectures) {
        // console.log('\nProcessing lecture:', lecture);

        const lectureSlug = this.getLectureSlug(lecture);
        const lectureTitle = this.sanitizeName(lecture.title);
        const sourceURL = `https://class101.net/ko/classes/${classId}/lectures/${lecture.lectureId}`;
        // console.log('Lecture slug:', lectureSlug);
        // console.log('Lecture title:', lectureTitle);
        // console.log('Source URL:', sourceURL);

        // 첨부파일 확인
        const filesDir = path.join(
          this.HTML_ROOT_DIR,
          'classes',
          classId,
          lectureSlug,
          'files'
        );
        const attachments = fs.existsSync(filesDir)
          ? fs.readdirSync(filesDir).map((file) => path.join(filesDir, file))
          : [];
        // console.log('Attachments:', attachments);

        // 노트 내용 변환
        const notePath = path.join(
          this.HTML_ROOT_DIR,
          'classes',
          classId,
          lectureSlug,
          'materials',
          'index.html'
        );
        let noteContent = '';
        if (fs.existsSync(notePath)) {
          const noteHtml = fs.readFileSync(notePath, 'utf8');
          const dom = new JSDOM(noteHtml);
          noteContent = this.convertHtmlToMarkdown(dom.window.document.body);
          // console.log('Note content found');
        } else {
          // console.log('No note content found at:', notePath);
        }

        // 마크다운 내용 생성
        const markdown = this.createMarkdownContent({
          classId,
          classTitle,
          lectureTitle,
          sourceURL,
          attachments,
          duration: lecture.duration,
          category,
          tags: `class101/${category}`,
          noteContent,
        });
        // console.log('Generated markdown content:', markdown);

        // 마크다운 파일 저장
        const markdownPath = path.join(
          classDir,
          `${lecture.sn.toString().padStart(3, '0')}_${lectureTitle}.md`
        );
        // console.log('Saving markdown to:', markdownPath);
        fs.writeFileSync(markdownPath, markdown, 'utf8');
        // console.log('Markdown file saved successfully');
      }
    } catch (error) {
      // console.log.error('Error in generateMarkdown:', error);
      throw error;
    }
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0'
      )}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  }

  createMarkdownContent(data) {
    const attachmentsList = data.attachments
      .map((filepath) => `  - "${path.basename(filepath)}"`)
      .join('\n');

    // category가 있는 경우에만 tags에 포함하고 공백 제거
    const tags = data.category
      ? `class101/${data.category.replace(/\s+/g, '')}`
      : 'class101';

    return `---
lectureTitle: ${data.lectureTitle}
classTitle: ${data.classTitle}
sourceURL: ${data.sourceURL}
attachments:${attachmentsList ? '\n' + attachmentsList : ''}
duration: ${this.formatDuration(data.duration)}
category: ${data.category}
tags: ${tags}
---

## 동영상
![${data.lectureTitle}](${data.sourceURL})

## 수업 노트
${data.noteContent}

## 강의 노트

`;
  }

  convertHtmlToMarkdown(element) {
    try {
      // "수업 노트" 텍스트를 포함하는 요소 찾기
      const titleElements = Array.from(element.querySelectorAll('*')).filter(
        (el) => el.textContent.trim() === '수업 노트'
      );

      if (!titleElements.length) {
        // console.log.log('수업 노트 제목을 찾을 수 없습니다.');
        return '';
      }

      const titleElement = titleElements[0];
      // console.log.log('Found title element:', titleElement.outerHTML);

      // 수업 노트 제목 요소 이후의 첫 번째 div 찾기
      let currentElement = titleElement;
      let contentDiv = null;

      // 다음 div를 찾을 때까지 순회
      while (currentElement && !contentDiv) {
        currentElement = currentElement.nextElementSibling;
        if (currentElement && currentElement.tagName.toLowerCase() === 'div') {
          contentDiv = currentElement;
        }
      }

      if (!contentDiv) {
        // 형제 요소에서 찾지 못한 경우, 부모의 다음 형제 요소들에서 찾기
        currentElement = titleElement.parentElement;
        while (currentElement && !contentDiv) {
          currentElement = currentElement.nextElementSibling;
          if (
            currentElement &&
            currentElement.tagName.toLowerCase() === 'div'
          ) {
            contentDiv = currentElement;
          }
        }
      }

      if (!contentDiv) {
        // console.log.log('수업 노트 내용을 찾을 수 없습니다.');
        return '';
      }

      // console.log.log('Found content div:', contentDiv.outerHTML);

      // HTML 문자열을 마크다운으로 변환
      let markdown = this.turndownService.turndown(contentDiv);

      // 이미지 패턴 뒤에 줄바꿈 추가
      markdown = markdown.replace(/!\[.*?\]\(.*?\)/g, '$&\n');

      // 연속된 강조 표시 수정
      markdown = markdown.replace(/\*\*\*\*/g, '** **');

      // 각 줄의 시작과 끝 공백 제거
      markdown = markdown
        .split('\n')
        .map((line) => line.trim()) // 각 줄의 앞뒤 공백 제거
        .join('\n');

      // 숫자로 시작하는 줄의 이스케이프 문자 제거
      markdown = markdown.replace(/(\d+)\\\./g, '$1.');

      // 모든 연속된 줄바꿈을 2개의 줄바꿈으로 변경
      markdown = markdown.replace(/\n+/g, '\n\n').trim();

      return markdown;
    } catch (error) {
      // console.log.error('Error converting HTML to Markdown:', error);
      return '';
    }
  }

  async generate(classId) {
    await this.generateMarkdown(classId);
  }

  async generateAllMarkdowns() {
    try {
      // myclasses.json 읽기
      const myclassesPath = path.join(this.JSON_ROOT_DIR, 'myclasses.json');
      const myclasses = JSON.parse(fs.readFileSync(myclassesPath, 'utf8'));

      console.log(`Found ${myclasses.length} classes to process`);

      // 각 클래스에 대해 순차적으로 마크다운 생성
      for (const classData of myclasses) {
        console.log(`\nProcessing class: ${classData.title} (${classData.classId})`);
        try {
          await this.generate(classData.classId);
          console.log(`Successfully generated markdown for ${classData.title}`);
        } catch (error) {
          console.error(`Failed to generate markdown for ${classData.title}:`, error.message);
          // 개별 클래스 실패 시에도 계속 진행
          continue;
        }
      }

      console.log('\nMarkdown generation completed for all classes');
    } catch (error) {
      console.error('Error in generateAllMarkdowns:', error);
      throw error;
    }
  }
}

// 직접 실행
if (process.argv[2] === '--all') {
  // 모든 클래스 처리
  const generator = new MarkdownGenerator();
  console.log('Starting markdown generation for all classes...');
  console.log(`Working directory: ${process.cwd()}`);

  generator
    .generateAllMarkdowns()
    .then(() => console.log('전체 마크다운 생성 완료'))
    .catch((error) => {
      console.error('마크다운 생성 중 에러 발생:', error);
      process.exit(1);
    });
} else {
  // 단일 클래스 처리 (기존 코드)
  const generator = new MarkdownGenerator();
  const testClassId = '5c6f91d274eabcfdafa1e5ff';

  console.log('Starting markdown generation...');
  console.log(`Working directory: ${process.cwd()}`);

  generator
    .generate(testClassId)
    .then(() => console.log('마크다운 생성 완료'))
    .catch((error) => {
      console.error('마크다운 생성 중 에러 발생:', error);
      process.exit(1);
    });
}

export { MarkdownGenerator };
