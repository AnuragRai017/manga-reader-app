You need the ID of the chapter first. Then, by calling the GET /at-home/server/:chapterId endpoint, you'll get all required fields to compute your page URLs:


GET https://api.mangadex.org/at-home/server/:chapterId
Field	Type	Description
.baseUrl	string	A valid base URL
.chapter.hash	string	Chapter Hash
.chapter.data	array of strings	ordered data quality filenames
.chapter.dataSaver	array of strings	ordered data-saver quality filenames
The page URLs are then in the format

$.baseUrl / $QUALITY / $.chapter.hash / $.chapter.$QUALITY[*]

Important notes:

The validity of the base URL is limited in time. We guarantee 15 minutes. Could be more, could be less. Call the /at-home/server/:chapter-id again if you need it after that long but then get a 403 error.
It is not literally /$.chapter.dataSaver[*]. That is a placeholder to mean (all) the elements (filenames) within the data/data-saver arrays, depending on the quality and pages you want.
#Example
Assuming chapter id: a54c491c-8e4c-4e97-8873-5b79e59da210.

#1. Get the chapter's image delivery metadata

GET https://api.mangadex.org/at-home/server/a54c491c-8e4c-4e97-8873-5b79e59da210

{
  "result": "ok",
  "baseUrl": "https://uploads.mangadex.org",
  "chapter": {
    "hash": "3303dd03ac8d27452cce3f2a882e94b2",
    "data": [
      "1-f7a76de10d346de7ba01786762ebbedc666b412ad0d4b73baa330a2a392dbcdd.png",
      "2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png",
      "3-d06c6f764fdc3c76ea7ae3b76493fdf1a32b8926f2b60ed207b5c2fed13d002e.png",
      "4-a614d6456b9b13931bc5c5ef23cb5f744671f0e1e08c7335682a32de78482f71.png",
      "5-1105a368fd73ae99a06d7aebd165a1ff4322539ba50022a967f7b5fb0a185ce5.png",
      "6-e8a3eac12d879c541c4a36da550d2c69cc9450cb9b1840a079f890facf5f0c89.png"
    ],
    "dataSaver": [
      "1-27e7476475e60ad4cc4cefdb9b2dce29d84f490e145211f6b2e14b13bdb57f33.jpg",
      "2-b4e2cd69df2648279b7d87d44f7860d3fc760aa442e08c49579359f3cf4b4f14.jpg",
      "3-b45f66bdac44652ea2eae40bb5788afe34b8ab5a66e69f0d406257804ddaeda1.jpg",
      "4-92b328471cca1b032bd99cd8506c945a2c3b5a5fd32275b0c4dbfd8ddcfe7e0a.jpg",
      "5-b2336d540fe4a2f9f452cec8e4b2d2ef894f66535e45a4468bf59a6d37f025fe.jpg",
      "6-09f2deb563e802464c161bf7bfa2b094a4727efb4f962d30cf8ee2857a0a66c8.jpg"
    ]
  }
}
Here, the base url happens to be https://uploads.mangadex.org but it could be whatever else.

Typically it will be very different if it's a MangaDex@Home node. Do NOT assume any format. It is not "a URL", it is not "a domain name", it's not "https:// followed by a domain name".

It is a string. No more no less. Just use it as-is.

#2. Construct page URLs
The full URLs are then

DATA (source/original quality)


https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/1-f7a76de10d346de7ba01786762ebbedc666b412ad0d4b73baa330a2a392dbcdd.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/3-d06c6f764fdc3c76ea7ae3b76493fdf1a32b8926f2b60ed207b5c2fed13d002e.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/4-a614d6456b9b13931bc5c5ef23cb5f744671f0e1e08c7335682a32de78482f71.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/5-1105a368fd73ae99a06d7aebd165a1ff4322539ba50022a967f7b5fb0a185ce5.png
https://uploads.mangadex.org/data/3303dd03ac8d27452cce3f2a882e94b2/6-e8a3eac12d879c541c4a36da550d2c69cc9450cb9b1840a079f890facf5f0c89.png
DATA-SAVER (compressed):


https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/1-27e7476475e60ad4cc4cefdb9b2dce29d84f490e145211f6b2e14b13bdb57f33.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/2-b4e2cd69df2648279b7d87d44f7860d3fc760aa442e08c49579359f3cf4b4f14.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/3-b45f66bdac44652ea2eae40bb5788afe34b8ab5a66e69f0d406257804ddaeda1.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/4-92b328471cca1b032bd99cd8506c945a2c3b5a5fd32275b0c4dbfd8ddcfe7e0a.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/5-b2336d540fe4a2f9f452cec8e4b2d2ef894f66535e45a4468bf59a6d37f025fe.jpg
https://uploads.mangadex.org/data-saver/3303dd03ac8d27452cce3f2a882e94b2/6-09f2deb563e802464c161bf7bfa2b094a4727efb4f962d30cf8ee2857a0a66c8.jpg
Do NOT send authentication headers when fetching images.

If you hit our image servers with authentication headers, your request will be rejected.

If you hit a 3rd-party server on mangadex.network, you are leaking the authentication token to the third-party operating that MangaDex@Home node.

#MangaDex@Home, load successes, failures and retries
Sometimes, a request for an image will fail. There can be many reasons for that. Typically it is caused by an unhealthy MangaDex@Home server.

In order to keep track of the health of the servers in the network and to improve the quality of service and reliability, we need you to report successes and failures when loading images.

The MangaDex@Home report endpoint is for this. For each image you retrieve (successfully or not) from a base url that doesn't contain mangadex.org.

Call the network report endpoint to notify it (see just below)
Call the /at-home/server/:chapterId endpoint again to get a new base url if it was a failure
But it failed and I still get the same server back!!

Then call the endpoint. If you don't, we cannot know that the server you got assigned to isn't working.

#The MangaDex@Home report endpoint
It is a POST request to https://api.mangadex.network/report (note that it's api.mangadex.network, ** not** api.mangadex.org) as follows.


POST https://api.mangadex.network/report
Content-Type: application/json
Field	Type	Description
url	string	The full URL of the image (including https:// )
success	boolean	true if the image was successfully retrieved, false otherwise
cached	boolean	true iff the server returned an X-Cache header with a value starting with HIT
bytes	number	The size (in bytes) of the retrieved image
duration	number	The time (in miliseconds) that the complete retrieval (not TTFB) of the image took
Note 1: The content-type header must be exactly application/json. Note 2: It's api.mangadex.network, not apimangadex.org

#MangaDex@Home report examples
Let's assume that for the example chapter above your base url was: https://foo.bar:5678/abcdef/1a2b3c4d.

#Success

POST https://api.mangadex.network/report
Content-Type: application/json

{
  "url": "https://foo.bar:5678/abcdef/1a2b3c4d/data/3303dd03ac8d27452cce3f2a882e94b2/2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png",
  "success": true,
  "bytes": 674687,
  "duration": 235,
  "cached": true
}
#Failure

POST https://api.mangadex.network/report
Content-Type: application/json

{
  "url": "https://foo.bar:5678/abcdef/1a2b3c4d/data/3303dd03ac8d27452cce3f2a882e94b2/2-2a5e95dfec7f15cd01f9a63835be18a22fb77a10fd2d62858c7dcbb6e6c622f9.png",
  "success": false,
  "bytes": 25,
  "duration": 235,
  "cached": false
}
N.B.: On a failure that doesn't result in any response (connection failure, bad SSL certificate, ...) just put 0 for bytes.

#About hardcoding base URLs
Damn, I wish I could load images slower, waste MangaDex's bandwidth, and get IP banned! But how?

Hardcoding your base URL is a solid approach!

First of all: Don't. The dynamic URLs we return on the /at-home/server/:chapter-id endpoint are almost always optimized based on your geographic location, so this is typically just a dumb thing to do besides during basic prototyping of your project. We also have stricter rate-limits on those, etc.

## Pages Download Process

1. **Endpoint**: Use the following endpoint to download chapter pages:
   - `https://api.mangadex.org/chapters/{chapterId}/at-home`

2. **Request Method**: `GET`

3. **Parameters**:
   - `chapterId`: The unique identifier of the chapter.

4. **Response Handling**:
   - On a successful response, extract `baseUrl`, `chapter.hash`, and `chapter.data` (or `chapter.dataSaver` for lower quality).
   - Construct the image URLs:
     - High Quality: `${baseUrl}/data/${hash}/${filename}`
     - Low Quality: `${baseUrl}/data-saver/${hash}/${filename}`

5. **Error Handling**:
   - If the response is not successful, implement a retry mechanism with exponential backoff up to 3 attempts.
   - If all retries fail, throw a descriptive error indicating the failure to fetch chapter pages.
