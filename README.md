# digital-library

This digital library is an interactive platform for exploring a collection of books using semantic embedding and visualization techniques. Traditional methods of linearly organizing books by author or topic are rigid and do not align with cognitive processes of associative thinking. This library leverages dimensionality reduction to create a dynamic and intuitive browsing experience based on semantic similarity.

**Users can view the library in three modes:**

- **3D:** Books are arranged in a three-dimensional semantic space with interactive camera navigation, rotation, and zooming.
- **2D:** Books are arranged in a two-dimensional scatterplot based on their semantic similarity with interactive zooming and panning.
- **List:** Books are presented in a sortable and filterable list format.

The positions of books in the 2D and 3D views are determined by embeddings generated from book descriptions and metadata using the Sentence Transformers model [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2). Dimensionality reduction is performed using either [t-SNE](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html) (T-Distributed Stochastic Neighbor Embedding) or [UMAP](https://umap-learn.readthedocs.io/en/latest/) (Uniform Manifold Approximation and Projection). This approach embeds meaning in the space itself. Two books that are close together are semantically similar, allowing users to discover related works intuitively.

The library contains all the books I've ever read. Book data is sourced from my personal library on [Goodreads](https://www.goodreads.com/review/list/20954505?shelf=read) and cover images are provided by the [Open Library API](https://openlibrary.org/developers/api). Visualization is implemented using [d3.js](https://d3js.org/) and [three.js](https://threejs.org/).
