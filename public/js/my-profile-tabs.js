function changeLayout(layout) {
  const cardViews = document.getElementsByClassName("cardView");
  const tableViews = document.getElementsByClassName("tableView");

  if (layout === "card") {
    for (let i = 0; i < cardViews.length; i++) {
      cardViews[i].style.display = "flex";
    }
    for (let i = 0; i < tableViews.length; i++) {
      tableViews[i].style.display = "none";
    }
  }
  if (layout === "table") {
    for (let i = 0; i < cardViews.length; i++) {
      cardViews[i].style.display = "none";
    }
    for (let i = 0; i < tableViews.length; i++) {
      tableViews[i].style.display = "flex";
    }
  }

  console.log(`Switching to ${layout} layout.`);
}

// Function to handle image preview
function handleImagePreview(input, previewId) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const previewImage = document.getElementById(previewId);
      previewImage.src = e.target.result; // Set image source to the selected file
      previewImage.style.display = "block"; // Display the image
    };

    reader.readAsDataURL(file); // Read file as Data URL
  }
}

// Event listener for the 'featureImage' input
const featureImage = document.getElementById("newUserImage");
if (featureImage) {
  featureImage.addEventListener("change", function () {
    handleImagePreview(this, "previewImage");
  });
}
