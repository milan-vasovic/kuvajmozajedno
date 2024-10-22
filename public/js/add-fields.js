// Adding new inputs and remove button for AddIngredients
//  get elemebt by id and add event listener
 document.getElementById("addIngredient").addEventListener("click", function (e) {
    e.preventDefault();
    const ingredientsContainer = document.getElementById("ingredientsContainer");
    const newIngredient = document.createElement("div");
    newIngredient.classList.add("input-container");
    const newIndex = Date.now(); // Jedinstveni indeks
    newIngredient.innerHTML = `
<input class="main-form__input" id="ingredient${newIndex}" type="text" name="ingredients" placeholder="Sastojci" required>
<input class="main-form__input" type="text" name="ingredientsAmount" placeholder="Količina" required>
<button type="button" class="btn btn-danger removeIngredient" data-index="${newIndex}">Izbacite</button>
`;
    ingredientsContainer.appendChild(newIngredient);
});

// Uklanjanje polja za sastojke
document.getElementById("ingredientsContainer").addEventListener("click", function (e) {
    if (e.target.classList.contains("removeIngredient")) {
        e.preventDefault();
        const ingredientContainer = e.target.parentElement;
        const index = ingredientContainer.getAttribute("data-index");
        ingredientContainer.remove();
    }
});

// Kod za dinamičko dodavanje polja za Steps
document.getElementById("addStep").addEventListener("click", function (e) {
    e.preventDefault();
    const stepsContainer = document.getElementById("stepsContainer");
    const newStep = document.createElement("div");
    const newIndex = Date.now(); // Jedinstveni indeks
    newStep.classList.add("main-form__step-container");
    newStep.innerHTML = `
<textarea class="main-form__textarea" id="step${newIndex}" name="steps" rows="4" placeholder="Korak" required></textarea>
<button class="btn btn-danger removeStep" data-index="${newIndex}">Izbacite</button>
`;
    stepsContainer.appendChild(newStep);
});

// Uklanjanje polja za Steps
document.getElementById("stepsContainer").addEventListener("click", function (e) {
    if (e.target.classList.contains("removeStep")) {
        e.preventDefault();
        const stepContainer = e.target.parentElement;
        const index = stepContainer.getAttribute("data-index");
        stepContainer.remove();
    }
});

// document.getElementById("addCategory").addEventListener("click", function (e) {
//     e.preventDefault();
//     const categoryContainer = document.getElementById("categoryContainer");
//     const newCategory = document.createElement("div");
//     const newIndex = Date.now(); // Unique index
//     newCategory.classList.add("main-form__category-container");

//     const input = document.createElement("input");
//     input.classList.add("main-form__input");
//     input.id = "category" + newIndex;
//     input.type = "text";
//     input.name = "category";
//     input.placeholder = "Kategorija";
//     input.required = true;

//     const button = document.createElement("button");
//     button.type = 'button';
//     button.classList.add("btn", "btn-danger", "removeCategory");
//     button.setAttribute("data-index", newIndex);
//     button.textContent = "Izbacite";

//     newCategory.appendChild(input);
//     newCategory.appendChild(button);

//     categoryContainer.appendChild(newCategory);
// });

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("addCategory").addEventListener("click", async function (e) {
        e.preventDefault();
  
        const categoryContainer = document.getElementById("categoryContainer");
        const newCategory = document.createElement("div");
        const newIndex = Date.now(); // Jedinstveni indeks
        newCategory.classList.add("main-form__category-container");
  
        // Fetch podaci iz JSON fajla ili API-ja
        try {
          const response = await fetch('/json/categories.json');
          const data = await response.json();
  
          // Kreiraj select element
          const select = document.createElement("select");
          select.classList.add("main-form__select");
          select.name = "category";
          select.required = true;
  
          // Popuni select opcijama iz JSON-a
          data.categories.forEach(mainCategory => {
            const optgroup = document.createElement("optgroup");
            optgroup.label = mainCategory.mainCategory;
  
            mainCategory.subCategories.forEach(subCategory => {
              const option = document.createElement("option");
              option.value = subCategory;
              option.textContent = subCategory;
              optgroup.appendChild(option);
            });
  
            select.appendChild(optgroup);
          });
  
          // Kreiraj dugme za brisanje
          const button = document.createElement("button");
          button.type = 'button';
          button.classList.add("btn", "btn-danger", "removeCategory");
          button.setAttribute("data-index", newIndex);
          button.textContent = "Izbacite";
  
          // Dodaj select i dugme za brisanje u novi element
          newCategory.appendChild(select);
          newCategory.appendChild(button);
  
          // Dodaj novi element u container
          categoryContainer.appendChild(newCategory);
  
          // Dodaj event listener za brisanje nove kategorije
          button.addEventListener("click", function () {
              categoryContainer.removeChild(newCategory);
          });
        } catch (error) {
          console.error("Greška pri učitavanju JSON podataka:", error);
        }
    });
  });
  

// Uklanjanje polja za Category
document.getElementById("categoryContainer").addEventListener("click", function (e) {
    if (e.target.classList.contains("removeCategory")) {
        e.preventDefault();
        const categoryContainer = e.target.parentElement;
        categoryContainer.remove();
    }
});

// // Kod za dinamičko dodavanje polja za Images
// document.getElementById("addImage").addEventListener("click", function (e) {
//     e.preventDefault();
//     const imagesContainer = document.getElementById("imagesContainer");
    
//     const currentImageFields = imagesContainer.querySelectorAll('input[type="file"]').length;

//     if (currentImageFields >= 4) {
//         alert("Ne možete dodati više od 5 slika!");
//         return; // Zaustavlja dalje izvršavanje
//     }

//     const newImage = document.createElement("div");
//     const newIndex = Date.now(); // Jedinstveni indeks
//     newImage.classList.add("main-form__image-container");
//     newImage.innerHTML = `
// <input class="main-form__input" id="image${newIndex}" type="file" name="images" placeholder="Slika" required>
// <button class="btn btn-danger removeImage" data-index="${newIndex}">Izbacite</button>
// `;
//     imagesContainer.appendChild(newImage);
// });

// Uklanjanje polja za Images
document.getElementById("imagesContainer").addEventListener("click", function (e) {
    if (e.target.classList.contains("removeImage")) {
        e.preventDefault();
        const imageContainer = e.target.parentElement;
        const index = imageContainer.getAttribute("data-index");
        imageContainer.remove();
    }
});

// Kod za dinamičko dodavanje polja za Nutritivne vrednosti
document.getElementById("addNutrition").addEventListener("click", function (e) {
    e.preventDefault();
    const nutritionsContainer = document.getElementById("nutritionsContainer");
    const newNutrition = document.createElement("div");
    const newIndex = Date.now(); // Jedinstveni indeks
    newNutrition.classList.add("input-container");
    newNutrition.innerHTML = `
<input class="main-form__input" id="nutrition${newIndex}" type="text" name="nutritions" placeholder="Nutritivna Vrednost" required>
<input class="main-form__input" id="nutritionsAmount${newIndex}" type="text" name="nutritionsAmount" placeholder="Količina" required>
<button class="btn btn-danger removeNutrition" data-index="${newIndex}">Izbacite</button>
`;
    nutritionsContainer.appendChild(newNutrition);
});

// Uklanjanje polja za Nutritivne vrednosti
document.getElementById("nutritionsContainer").addEventListener("click", function (e) {
    if (e.target.classList.contains("removeNutrition")) {
        e.preventDefault();
        const nutritionContainer = e.target.parentElement;
        const index = nutritionContainer.getAttribute("data-index");
        nutritionContainer.remove();
    }
});

document.getElementById('recipeTypeSelect').addEventListener('change', function() {
    let selectedValue = this.value;
    let costInput = document.getElementById('costInput');
    let costInputField = document.getElementById('cost');
    
    if (selectedValue === 'protected') {
        costInput.style.display = 'block';
        costInputField.removeAttribute('readonly'); // Allow editing
    } else {
        costInput.style.display = 'none';
        costInputField.value = 0;
        costInputField.setAttribute('readonly', 'readonly');
    }
});

// Function to handle image preview
function handleImagePreview(input, previewId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();

        reader.onload = function(e) {
            const previewImage = document.getElementById(previewId);
            previewImage.src = e.target.result;  // Set image source to the selected file
            previewImage.style.display = "block";  // Display the image
        }

        reader.readAsDataURL(file);  // Read file as Data URL
    }
}

// Event listener for the 'featureImage' input
const featureImage = document.getElementById('featureImage');
if(featureImage) {
    featureImage.addEventListener('change', function() {
        handleImagePreview(this, 'previewImage');
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Event listener for initial 'images' inputs (multiple images)
    document.querySelectorAll('input.imgs').forEach((input, index) => {
        input.addEventListener('change', function() {
            handleImagePreview(this, `imagesPreview${index}`);
        });
    });
});

// Event listener for initial 'images' inputs (multiple images)
document.querySelectorAll('input[class="imgs"]').forEach((input, index) => {
    input.addEventListener('change', function() {
        handleImagePreview(this, `imagesPreview${index}`);
    });
});

// Adding new image inputs dynamically
document.getElementById('addImage').addEventListener('click', function(e) {
    e.preventDefault();
    const imagesContainer = document.getElementById("imagesContainer");
    const newIndex = Date.now();  // Create unique index
    const newImageContainer = document.createElement("div");
    newImageContainer.classList.add("main-form__image-container");
    newImageContainer.innerHTML = `
        <input class="main-form__input" id="image${newIndex}" type="file" name="images" placeholder="Izaberite Sliku">
        <button type="button" class="btn btn-danger removeImage" data-index="${newIndex}">Izbacite</button>
        <img alt="Prikaz slike" id="imagesPreview${newIndex}" src="" style="display:none; max-width: 300px;" />
    `;
    imagesContainer.appendChild(newImageContainer);

    // Add event listener for newly added input
    newImageContainer.querySelector('input[name="images"]').addEventListener('change', function() {
        handleImagePreview(this, `imagesPreview${newIndex}`);
    });

    // Event listener for remove button
    newImageContainer.querySelector('.removeImage').addEventListener('click', function() {
        newImageContainer.remove();  // Remove the entire container
    });
});