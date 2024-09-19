function changeLayout(layout) {
  const cardViews = document.getElementsByClassName('cardView');
  const tableViews = document.getElementsByClassName('tableView');

  if (layout === 'card') {
    for (let i = 0; i < cardViews.length; i++) {
      cardViews[i].style.display = 'flex';
    }
    for (let i = 0; i < tableViews.length; i++) {
      tableViews[i].style.display = 'none';
    }
  }
  if (layout === 'table') {
    for (let i = 0; i < cardViews.length; i++) {
      cardViews[i].style.display = 'none';
    }
    for (let i = 0; i < tableViews.length; i++) {
      tableViews[i].style.display = 'flex';
    }
  }

  console.log(`Switching to ${layout} layout.`);
}
