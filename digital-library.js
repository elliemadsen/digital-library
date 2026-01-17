// Populate sort by dropdown with options
function populateSortDropdown() {
  const sortSelect = document.getElementById("sort-select");
  sortSelect.innerHTML = '';
  const options = [
    { value: 'title', label: 'Title' },
    { value: 'author', label: 'Author' },
    { value: 'rating', label: 'Rating' },
    { value: 'date read', label: 'Date Read' }
  ];
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    sortSelect.appendChild(option);
  });
  sortSelect.value = 'date read';
}
// Global tooltip functions
function showBookDetails(title, author, event) {
  d3.select(".tooltip").remove(); // Remove any existing tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(0, 0, 0, 0.5)")
    .style("color", "#fff")
    .style("font-size", "0.8rem")
    .style("padding", "5px")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .html(title + "<br>" + author)
    .style("opacity", 1);

  d3.select("body").on("mousemove", function (event) {
    tooltip
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY + 10}px`);
  });
}

function hideBookDetails() {
  d3.select(".tooltip").remove();
}

// Texture cache
const textureCache = new Map();

function loadTexture(url, callback, errorCallback) {
  if (textureCache.has(url)) {
    callback(textureCache.get(url));
  } else {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      textureCache.set(url, texture);
      callback(texture);
    };
    img.onerror = errorCallback;
    img.src = url;
  }
}

let embeddingType = 'tsne'; // 'tsne' or 'umap'

// fetch data from google sheets using cloud api key and construct CSV
function fetchCSVData() {
  const sheetId = "1moYiL52ZN9F20QZ-uYoO91Bh3AtkJYEoNcyv6MuRI2Y";
  const sheetRange = "Sheet1";
  const apiKey = "AIzaSyAGQtw4Jdd-BCe6-8PIRfUeQp8lwKJurfE";

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetRange}?key=${apiKey}`;

  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const rows = data.values;
      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header.trim() === `embedding_2d_${embeddingType}`) {
            const embedding = JSON.parse(row[index] || "[0,0]");
            if (embedding.length >= 2) {
              obj["x"] = embedding[0];
              obj["y"] = embedding[1];
            }
          } else if (header.trim() === `embedding_3d_${embeddingType}`) {
            const embedding = JSON.parse(row[index] || "[0,0,0]");
            if (embedding.length >= 3) {
              obj["x3"] = embedding[0];
              obj["y3"] = embedding[1];
              obj["z3"] = embedding[2];
            }
          } else {
            obj[header.trim()] = row[index] || "";
          }
        });
        return obj;
      });
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      throw error;
    });
}

// Parse a CSV line, handling quoted fields
function parseCSVLine(line) {
  const regex = /("(?:[^"]|"")*")|([^,"]+)/g;
  const values = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
    values.push(match[0].replace(/(^"|"$)/g, "").replace(/""/g, '"')); // Remove surrounding quotes and handle doubled quotes
  }
  return values;
}

// Generate HTML for book objects (bookshelf)
function generateBooksHTML(books) {
  return books
    .map(
      (book) => `
    <div class="book">
        <img src="https://covers.openlibrary.org/b/isbn/${
          book.isbn
        }-L.jpg" alt="${book.title}" class="book-image">
        <div class="flex-column book-text">
            <p>${book.title}</p>
            <p>${book.author}</p>
            <p class="rating">${"★".repeat(book.rating)}</p>
        </div>
    </div>
    `
    )
    .join("");
}

// Sort books based on criteria
function sortBooks(books, criteria) {
  function sortByDate(a, b) {
    const dateA = new Date(a["date read"]);
    const dateB = new Date(b["date read"]);
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    return dateB - dateA;
  }
  return books.slice().sort((a, b) => {
    if (criteria === "date read") {
      return sortByDate(a, b);
    } else if (criteria === "rating") {
      const ratingComparison = b.rating - a.rating;
      if (ratingComparison !== 0) return ratingComparison;
      return sortByDate(a, b);
    } else {
      // Fallback to empty string if property is missing
      const aVal = (a[criteria] ?? '').toString();
      const bVal = (b[criteria] ?? '').toString();
      return aVal.localeCompare(bVal);
    }
  });
}

// Filter books based on the selected shelf
function filterBooksByShelf(books, shelf) {
  if (!shelf) return books;
  return books.filter((book) => {
    return book.bookshelves
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(shelf.toLowerCase());
  });
}

// Load books, sort, and filter based on user input
function displayBooks(sortBy, selectedShelf, mode) {
  fetchCSVData()
    .then((csvData) => {
      const allBooks = csvData;
      const shelfBooks = filterBooksByShelf(allBooks, selectedShelf);
      const sortedBooks = sortBooks(shelfBooks, sortBy);
      if (mode === 'list') {
        const container = document.getElementById("book-container");
        container.innerHTML = generateBooksHTML(sortedBooks);
        container.style.justifyContent = 'flex-start';
        container.style.alignItems = 'flex-start';
      } else if (mode === '2d') {
        createScatterPlot(allBooks, sortedBooks);
      } else if (mode === '3d') {
        create3DPlot(allBooks, sortedBooks);
      }
    })
    .catch((error) => {
      console.error("Error fetching or processing CSV:", error);
    });
}

let transformState = d3.zoomIdentity;
let isInitialLoad = true;
let currentMode = '3d';

function createScatterPlot(allBooks, books) {
  const container = document.getElementById("embeddingChart");
  container.innerHTML = "";

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const imageGroup = svg.append("g");

  // Add zoom event
  const zoom = d3
    .zoom()
    .scaleExtent([0, 10])
    .on("zoom", (event) => {
      transformState = event.transform;
      imageGroup.attr("transform", transformState);
    });

  // Apply the zoom behavior to the SVG
  svg.call(zoom);

  // Restore previous zoom state if available
  svg.call(zoom.transform, transformState);

  // Find min and max values for scaling the positions
  const minX = Math.min(...allBooks.map((book) => book.x));
  const maxX = Math.max(...allBooks.map((book) => book.x));
  const minY = Math.min(...allBooks.map((book) => book.y));
  const maxY = Math.max(...allBooks.map((book) => book.y));

  // Function to normalize the x and y positions
  function normalize(value, min, max, size) {
    return ((value - min) / (max - min)) * size;
  }

  book_width = 40;
  book_height = book_width * 1.5;

  // Add book covers
  books.forEach((book) => {
    if (book.x !== 0 && book.y !== 0) {
      const normalizedX = normalize(book.x, minX, maxX, width);
      const normalizedY = normalize(book.y, minY, maxY, height);

      imageGroup
        .append("image")
        .attr(
          "xlink:href",
          `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`
        )
        .attr("x", normalizedX - book_width / 2)
        .attr("y", normalizedY - book_height / 2)
        .attr("width", book_width)
        .attr("height", book_height)
        .attr("alt", book.title)
        .on("mouseover", function () {
          d3.select(this).style("opacity", 0.7); // Hover effect
          showBookDetails(book.title, book.author);
        })
        .on("mouseout", function () {
          d3.select(this).style("opacity", 1);
          hideBookDetails();
        });
    }
  });
}

// Create 3D scatter plot with three.js
function create3DPlot(allBooks, books) {
  const container = document.getElementById("threeChart");
  container.innerHTML = "";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff); // White background

  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  camera.position.set(0, 0, 200);
  controls.update();

  // Find min and max for normalization
  const minX = Math.min(...allBooks.map((book) => book.x3 || 0));
  const maxX = Math.max(...allBooks.map((book) => book.x3 || 0));
  const minY = Math.min(...allBooks.map((book) => book.y3 || 0));
  const maxY = Math.max(...allBooks.map((book) => book.y3 || 0));
  const minZ = Math.min(...allBooks.map((book) => book.z3 || 0));
  const maxZ = Math.max(...allBooks.map((book) => book.z3 || 0));

  const range = 200; // Scale range

  function normalize(value, min, max) {
    return ((value - min) / (max - min) - 0.5) * range;
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  books.forEach((book) => {
    if (book.x3 !== undefined && book.y3 !== undefined && book.z3 !== undefined) {
      const url = `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`;
      loadTexture(url, (texture) => {
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(
          normalize(book.x3, minX, maxX),
          normalize(book.y3, minY, maxY),
          normalize(book.z3, minZ, maxZ)
        );
        sprite.scale.set(10, 15, 1); // Adjust size
        sprite.userData = { title: book.title, author: book.author };
        scene.add(sprite);
      }, (error) => {
        console.error('Texture failed to load for', book.isbn, error);
        // emadsen: comment this in to Fallback to black square
        // const fallbackMaterial = new THREE.SpriteMaterial({ color: 0x000000 });
        // const sprite = new THREE.Sprite(fallbackMaterial);
        // sprite.position.set(
        //   normalize(book.x3, minX, maxX),
        //   normalize(book.y3, minY, maxY),
        //   normalize(book.z3, minZ, maxZ)
        // );
        // sprite.scale.set(10, 15, 1);
        // sprite.userData = { title: book.title, author: book.author };
        // scene.add(sprite);
      });
    }
  });

  // emadsen: comment this in to add popup book details on hover in 3D plot

  // function onMouseMove(event) {
  //   const rect = renderer.domElement.getBoundingClientRect();
  //   mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  //   mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  //   raycaster.setFromCamera(mouse, camera);
  //   const intersects = raycaster.intersectObjects(scene.children);
  //   if (intersects.length > 0) {
  //     const obj = intersects[0].object;
  //     if (obj.userData.title) {
  //       showBookDetails(obj.userData.title, obj.userData.author, event);
  //     }
  //   } else {
  //     hideBookDetails();
  //   }
  // }

  // renderer.domElement.addEventListener('mousemove', onMouseMove);
  // renderer.domElement.addEventListener('mouseleave', hideBookDetails);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// Populate bookshelf dropdown with unique values from the books data
function populateShelfDropdown() {
  const shelves = new Set();
  allBooks.forEach((book) => {
    if (book.bookshelves) {
      book.bookshelves.split(",").forEach((shelf) => {
        const trimmedShelf = shelf.trim().toLowerCase();
        if (trimmedShelf) {
          shelves.add(trimmedShelf);
        }
      });
    }
  });

  const shelfSelect = document.getElementById("shelf-select");
  shelfSelect.innerHTML = '';
  // Always add 'all' as the first option
  const allOption = document.createElement("option");
  allOption.value = '';
  allOption.textContent = 'all';
  shelfSelect.appendChild(allOption);

  sortedShelves = Array.from(shelves).sort();
  sortedShelves.forEach((shelf) => {
    const option = document.createElement("option");
    option.value = shelf;
    option.textContent = shelf;
    shelfSelect.appendChild(option);
  });
  shelfSelect.value = '';
}

function processEvent() {
  const sortBy = document.getElementById("sort-select").value;
  const selectedShelf = document.getElementById("shelf-select").value;
  displayBooks(sortBy, selectedShelf, currentMode);
}

function switchMode(mode) {
  currentMode = mode;
  // Only update mode toggle buttons
  ['3d', '2d', 'list'].forEach(m => {
    const btn = document.getElementById(`btn-${m}`);
    if (btn) {
      if (m === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  document.querySelectorAll('.chart').forEach(chart => chart.style.display = 'none');
  // Show/hide embedding toggle and sort/filter controls based on mode
  const embeddingSection = document.getElementById('embedding-section');
  const filterSortSection = document.getElementById('filter-sort-section');
  const sortLabel = document.getElementById('sort-label');
  const sortSelect = document.getElementById('sort-select');
  // Embedding toggle only in 2d/3d
  if (mode === '2d' || mode === '3d') {
    embeddingSection.style.display = '';
  } else {
    embeddingSection.style.display = 'none';
  }
  // Filter by always visible, sort by only in list
  if (mode === 'list') {
    sortLabel.style.display = '';
    sortSelect.style.display = '';
  } else {
    sortLabel.style.display = 'none';
    sortSelect.style.display = 'none';
  }
  // Clear other containers
  if (mode === 'list') {
    document.getElementById('embeddingChart').innerHTML = '';
    document.getElementById('threeChart').innerHTML = '';
    document.getElementById('book-container').style.display = 'flex';
  } else if (mode === '2d') {
    document.getElementById('book-container').innerHTML = '';
    document.getElementById('threeChart').innerHTML = '';
    document.getElementById('embeddingChart').style.display = 'block';
  } else if (mode === '3d') {
    document.getElementById('book-container').innerHTML = '';
    document.getElementById('embeddingChart').innerHTML = '';
    document.getElementById('threeChart').style.display = 'block';
  }
  processEvent();
}

// Event listeners
document.getElementById("sort-select").addEventListener("change", (event) => {
  processEvent();
});
document.getElementById("shelf-select").addEventListener("change", (event) => {
  processEvent();
});

document.getElementById("btn-3d").addEventListener("click", () => switchMode('3d'));
document.getElementById("btn-2d").addEventListener("click", () => switchMode('2d'));
document.getElementById("btn-list").addEventListener("click", () => switchMode('list'));
document.getElementById("btn-tsne").addEventListener("click", () => {
  if (embeddingType !== 'tsne') {
    embeddingType = 'tsne';
    document.getElementById('btn-tsne').classList.add('active');
    document.getElementById('btn-umap').classList.remove('active');
    if (currentMode === '2d' || currentMode === '3d') {
      processEvent();
    }
  }
});
document.getElementById("btn-umap").addEventListener("click", () => {
  if (embeddingType !== 'umap') {
    embeddingType = 'umap';
    document.getElementById('btn-umap').classList.add('active');
    document.getElementById('btn-tsne').classList.remove('active');
    if (currentMode === '2d' || currentMode === '3d') {
      processEvent();
    }
  }
});
document.getElementById("btn-info").addEventListener("click", () => {
  document.getElementById('infoPopup').style.display = 'flex';
});

document.querySelector('.close-btn').addEventListener("click", () => {
  document.getElementById('infoPopup').style.display = 'none';
});

document.getElementById('infoPopup').addEventListener("click", (e) => {
  if (e.target === document.getElementById('infoPopup')) {
    document.getElementById('infoPopup').style.display = 'none';
  }
});

// Initial load
window.addEventListener("load", () => {
  fetchCSVData()
    .then((csvData) => {
      allBooks = csvData;
      populateShelfDropdown();
      populateSortDropdown();
      // Hide filter/sort section by default if starting in 3d
      const filterSortSection = document.getElementById('filter-sort-section');
      filterSortSection.style.display = '';
      switchMode('3d'); // Default to 3d
    })
    .catch((error) => {
      console.error("Error fetching or processing CSV:", error);
    });
});
