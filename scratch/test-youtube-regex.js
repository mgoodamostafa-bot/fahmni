const getYoutubeId = (url) => {
  if (!url) return null;
  const trimmed = url.trim();
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?\s]*).*/;
  const match = trimmed.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const urls = [
  "https://youtu.be/EPYPEfFym4g?si=3Kq3cH6vaRkJtkfp",
  "https://www.youtube.com/live/WtOxodbFMTE?si=ciksItju0GIJacAs",
  "https://www.youtube.com/watch?v=EPYPEfFym4g",
  "https://youtu.be/EPYPEfFym4g",
  "https://www.youtube.com/embed/EPYPEfFym4g"
];

urls.forEach(u => {
  console.log(`URL: ${u} => ID: ${getYoutubeId(u)}`);
});
