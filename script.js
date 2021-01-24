const searchField = document.querySelector("#searchString");
const searchBTN = document.querySelector("#searchBTN");

function enableExtension() {
  searchField.removeAttribute("disabled");
  searchBTN.removeAttribute("disabled");
}

async function fetchGraphQL(gqlBody) {
  return fetch("https://www.mydealz.de/graphql", {
    headers: {
      "content-type": "application/json",
    },
    body: gqlBody,
    method: "POST",
    mode: "cors",
    referrer:
      "https://www.mydealz.de/deals/severin-mw-7755-3-in1-mikrowelle-1741647",
  }).then((resp) => resp.json());
}

COMMENTS_PAGINATION_REQUEST = (threadID) =>
  `[{"query":"query comments($filter: CommentFilter!, $limit: Int) {  comments(filter: $filter, limit: $limit) {
     pagination {      ...paginationFields    }  }}
     fragment paginationFields on Pagination {  count  current  last  next  previous  size  order}",
     "variables":{"filter":{"threadId":{"eq":"${threadID}"},"order":null}}}]`
    //
    .replaceAll("\n", "");

COMMENTS_GRAPHQL_REQUEST = (threadID, page) =>
  `[{"query":"query comments($filter: CommentFilter!, $limit: Int, $page: Int) {  comments(filter: $filter, limit: $limit, page: $page) {    items {      ...commentFields    }
    }}

   fragment commentFields on Comment {  commentId  threadId  url  preparedHtmlContent  user {    ...userMediumAvatarFields    ...userNameFields    ...userPersonaFields    bestBadge {      ...badgeFields    }  }
   likes  deletable  liked  reported  reportable  source  status  createdAt  updatedAt  ignored  popular  deletedBy {    username  }  notes {    content    createdAt    user {      username    }  }
   lastEdit {    reason    timeAgo    userId  }}

   fragment userMediumAvatarFields on User {  userId  isDeletedOrPendingDeletion  imageUrls(slot: \\"default\\", variations: [\\"user_small_avatar\\"])}
   fragment userNameFields on User {  userId  username  isUserProfileHidden  isDeletedOrPendingDeletion}
   fragment userPersonaFields on User {  persona {    type    text  }}
   fragment badgeFields on Badge {  badgeId  level {    ...badgeLevelFields  }}
   fragment badgeLevelFields on BadgeLevel {  key  name  description}
   ",

   "variables":{"filter":{"threadId":{"eq":"${threadID}"},"order":null},"page":${page}}}]`
    //
    .replaceAll("\n", "");

async function runSearch(searchString, dealID) {
  const paginationData = await fetchGraphQL(
    COMMENTS_PAGINATION_REQUEST(dealID)
  );
  const pagination = paginationData[0].data.comments.pagination;

  const comments = [];

  const pages = pagination.last;

  console.log(`Fetching ${pages} pages...`);

  const requests = [];

  for (let i = 1; i <= pages; i++) {
    const currPageComments = fetchGraphQL(COMMENTS_GRAPHQL_REQUEST(dealID, i));
    requests.push(currPageComments);
  }
  const pageComments = await Promise.allSettled(requests);

  pageComments.forEach((page) => {
    console.log(page);
    comments.push(...page.value[0].data.comments.items);
  });

  console.log(`Fetched ${comments.length} comments`);
  console.log(`Searching for ${searchString}`);

  const searchResults = [];
  comments.forEach((comment) => {
    if (comment.preparedHtmlContent.toLowerCase().includes(searchString)) {
      searchResults.push(comment);
    }
  });

  console.log(`Found ${searchResults.length} results:`);
  console.log(searchResults);

  const resultsDiv = document.querySelector("#results");
  let resultsHTML = "";
  searchResults.forEach((result, index) => {
    resultsHTML += `<div>
      <h3><a href="${result.url}">${index}. - by ${result.user.username}</a></h3>
      ${result.preparedHtmlContent}
    </div>
    <hr>`;
  });
  resultsDiv.innerHTML = resultsHTML;
}

function checkIfMyDealz() {
  chrome.tabs.query(
    { active: true, windowId: chrome.windows.WINDOW_ID_CURRENT },
    function (tabs) {
      const url = tabs[0].url;
      if (!url.includes("mydealz.de")) {
        return;
      }
      init(url);
    }
  );
}

function init(url) {
  console.log(url);
  enableExtension();
  searchBTN.addEventListener("click", (e) => {
    const text = searchField.value;
    console.log("debug");
    if (text.length === 0) {
      return;
    }

    const locationPieces = url.split("?")[0].split("/");
    const lastPiece = locationPieces[locationPieces.length - 1];

    if (lastPiece.length === 0) {
      return;
    }

    const dealPieces = lastPiece.split("-");
    const dealID = dealPieces[dealPieces.length - 1];

    if (isNaN(dealID)) {
      return;
    }

    runSearch(text, dealID);
  });
}

checkIfMyDealz();
