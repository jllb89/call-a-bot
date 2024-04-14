let publisher;
let session;
let userRole = 'user'; // Set this dynamically based on the logged-in user's role
let queryParams = new URLSearchParams(window.location.search);
let roomID = queryParams.get('room');

console.log("Fetched Room ID from URL:", roomID); // This line logs the room ID to the console
console.log(`Making fetch call with roomID: ${roomID}`);

// Fetch session information and set up video call
fetch(`/get-session-info?role=${userRole}&room=${roomID}`)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const apiKey = data.apiKey;
        const sessionId = data.sessionId;
        const token = data.token;

        console.log('API Key:', apiKey);
        console.log('Session ID:', sessionId);
        console.log('Token:', token);

        session = OT.initSession(apiKey, sessionId);

        session.on('streamCreated', function (event) {
            console.log('Stream created:', event.stream);
            session.subscribe(event.stream, 'subscriber', {insertMode: 'append',
                width: '100%',
                height: '100%'
            }, function(error) {
                if (error) {
                    console.error('Error subscribing to stream:', error);
                } else {
                    console.log('Subscribed to stream:', event.stream.streamId);
                }
            });
        });

        session.connect(token, function (error) {
            if (error) {
                console.error('Error connecting:', error);
            } else {
                console.log('Connected to session:', sessionId);
                publisher = OT.initPublisher('publisher', {
                    insertMode: 'append',
                    width: '100%',
                    height: '100%'
                });
                session.publish(publisher, function (error) {
                    if (error) {
                        console.error('Error publishing:', error);
                    } else {
                        console.log('Fetch error:', error.message);
                    }
                });
            }
        });
    })
    .catch(error => console.error('Error fetching session info:', error));

// UI Controls for video call
function toggleMute() {
    if (publisher.stream.hasAudio) {
        publisher.publishAudio(false);
    } else {
        publisher.publishAudio(true);
    }
}

function toggleVideo() {
    if (publisher.stream.hasVideo) {
        publisher.publishVideo(false);
    } else {
        publisher.publishVideo(true);
    }
}

function hangUp() {
    session.disconnect();
}
