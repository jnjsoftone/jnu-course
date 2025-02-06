import { loadJson, saveJson, sanitizeName, PLATFORM, sleepAsync } from 'jnu-abc';
import dotenv from 'dotenv';
dotenv.config({ path: `../../.env.${PLATFORM}` });
const { CLASS101_CATEGORY_URL, CLASS101_JSON_ROOT, CLASS101_GRAPHQL_URL } = process.env;

// ** products
const fetchCategoryProducts = async (categoryId, cursor = null) => {
  const response = await fetch(CLASS101_GRAPHQL_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'CategoryProductsV3OnCategoryProductList',
      variables: {
        filter: {
          purchaseOptions: ['Lifetime', 'Rental', 'Subscription'],
        },
        categoryId,
        first: 1000,
        isLoggedIn: true,
        sort: 'Popular',
        originalLanguages: [],
        after: cursor || undefined,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: 'de9123f7372649c2874c9939436d6c5417a48b55af12045b7bdaea7de0a079cc',
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

//
const fetchProducts = async (subCategories: any[] = [], save: boolean = true) => {
  subCategories = subCategories ?? loadJson(`${CLASS101_JSON_ROOT}/subCategories.json`);
  let products: any[] = [];

  for (const subCategory of subCategories) {
    const response: any = await fetchCategoryProducts(subCategory.categoryId);
    await sleepAsync(3000);
    if (
      !response ||
      !('data' in response) ||
      !response.data?.categoryProductsV3 ||
      response.data.categoryProductsV3?.edges?.length === 0
    ) {
      console.log(`No products in ${subCategory.title} ${subCategory.categoryId}`);
      continue;
    }

    response.data.categoryProductsV3.edges.map((edge) => {
      const node = edge.node;
      let _imageId = '';
      try {
        _imageId = node.coverImageUrl.split('/').pop().split('.')[0];
      } catch (error) {
        console.log(`No imageId: ${node.title}, ${node._id}`);
      }

      const [
        productId,
        title,
        imageId,
        klassId,
        likedCount,
        firestoreId,
        categoryId,
        categoryTitle,
        authorId,
        authorName,
      ] = [
        node._id,
        node.title,
        _imageId,
        node.klassId,
        node.likedCount,
        node.firestoreId,
        node.category.id,
        node.category.title,
        node.author._id,
        node.author.displayName,
      ];
      const product: any = {
        productId,
        title,
        imageId,
        klassId,
        likedCount,
        firestoreId,
        categoryId,
        categoryTitle,
        authorId,
        authorName,
      };
      // productId가 중복되면 push하지 않도록
      if (!products.find((p: any) => p.productId === product.productId)) {
        products.push(product);
      }
      if (save) saveJson(`${CLASS101_JSON_ROOT}/products.json`, products);
    });
  }

  return products;
};

export { fetchProducts };

// * TEST
// fetchProducts();
