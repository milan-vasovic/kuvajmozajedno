const backdrop = document.querySelector('.backdrop');
const sideDrawer = document.querySelector('.mobile-nav');
const menuToggle = document.querySelector('#side-menu-toggle');

function backdropClickHandler() {
  backdrop.style.display = 'none';
  sideDrawer.classList.remove('open');
}

function menuToggleClickHandler() {
  backdrop.style.display = 'block';
  sideDrawer.classList.add('open');
}

backdrop.addEventListener('click', backdropClickHandler);
menuToggle.addEventListener('click', menuToggleClickHandler);

function openTab(tabName, par) {  
  let value1;
  let value2;

  if (par == 1) {
    value1 = '.tab';
    value2 = '.';
  }
  if (par == 2) {
    value1 = '.my-tab';
    value2 = '.my-';
  }
  if (par == 3) {
    value1 = '.recipe-tab';
    value2 = '.recipe-';
  }
  if (par == 4) {
    value1 = '.book-tab';
    value2 = '.book-';
  }
  if (par == 5) {
    value1 = '.sub-tab';
    value2 = '.sub-';
  }
  if (par == 6) {
    value1 = '.follow-tab';
    value2 = '.follow-';
  }
  const tabs = document.querySelectorAll(value1);
  const tabContents = document.querySelectorAll(value2 + 'tab-content');

  tabs.forEach(tab => {
    tab.classList.remove('active');
  });

  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  const activeTab = document.querySelector(`.btn[data-tab="${tabName}"]`);
  const activeTabContent = document.querySelector(value2 + `tab-content[data-tab="${tabName}"]`);

  if (activeTab && activeTabContent) {
    activeTab.classList.add('active');
    activeTabContent.classList.add('active');
  } else {
    console.error(`Tab or content not found: ${tabName}`);
  }
}

function changeImage(newImage, id) {
  let newId;
  if (id) {
    newId = id;
  } else {
    newId = "";
  }

  let what = ".main-image" + newId + " img"
  document.querySelector(what).src = newImage;
}


function toggleAddToBookForm() {
  var div = document.querySelector(".add-to-book__container");

  if (!div.classList.contains("active")) {
    div.classList.add("active");
  } else {
    div.classList.remove("active");
  }
}

function togglRemoveFromBookForm() {
  var div = document.querySelector(".remove-from-book__container");

  if (!div.classList.contains("active")) {
    div.classList.add("active");
  } else {
    div.classList.remove("active");
  }
}

function togglEditImageForm() {
  var div = document.querySelector(".edit-user-image__container");

  if (!div.classList.contains("active")) {
    div.classList.add("active");
  } else {
    div.classList.remove("active");
  }
}

function togglEditSubCost() {
  var div = document.querySelector(".edit-sub-cost__container");

  if (!div.classList.contains("active")) {
    div.classList.add("active");
  } else {
    div.classList.remove("active");
  }
}
