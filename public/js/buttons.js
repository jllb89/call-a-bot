function toggleMute() {
    const muteButton = document.getElementById('muteButton');
    if (publisher.stream.hasAudio) {
        publisher.publishAudio(false);
        muteButton.src = '../resources/svg/mute_on.svg';
    } else {
        publisher.publishAudio(true);
        muteButton.src = '../resources/svg/mute_off.svg';
    }
}

function toggleVideo() {
    const videoButton = document.getElementById('videoButton');
    if (publisher.stream.hasVideo) {
        publisher.publishVideo(false);
        videoButton.src = '../resources/svg/camera_off.svg';
    } else {
        publisher.publishVideo(true);
        videoButton.src = '../resources/svg/camera_on.svg';
    }
}