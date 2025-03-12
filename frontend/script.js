// Global variables
const API_BASE_URL = 'http://localhost:3000/api';
let currentVideoInfo = null;
let currentJobId = null;
let currentSegments = [];
let completedSegments = [];
let statusCheckInterval = null;

// DOM elements
const videoUrlInput = document.getElementById('videoUrl');
const checkUrlBtn = document.getElementById('checkUrlBtn');
const urlCard = document.getElementById('urlCard');
const videoInfoCard = document.getElementById('videoInfoCard');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoYoutubeLink = document.getElementById('videoYoutubeLink');
const videoTitle = document.getElementById('videoTitle');
const videoUploader = document.getElementById('videoUploader');
const videoUploadDate = document.getElementById('videoUploadDate');
const videoDuration = document.getElementById('videoDuration');
const videoViews = document.getElementById('videoViews');
const qualityCard = document.getElementById('qualityCard');
const qualitySelect = document.getElementById('qualitySelect');
const segmentsCard = document.getElementById('segmentsCard');
const segmentsHeader = document.getElementById('segmentsHeader');
const addSegmentBtn = document.getElementById('addSegmentBtn');
const segmentsContainer = document.getElementById('segmentsContainer');
const extractBtnContainer = document.getElementById('extractBtnContainer');
const extractBtn = document.getElementById('extractBtn');
const newExtractionContainer = document.getElementById('newExtractionContainer');
const newExtractionBtn = document.getElementById('newExtractionBtn');
const videoPlayerModal = document.getElementById('videoPlayerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoDownloadBtn = document.getElementById('videoDownloadBtn');

// Event listeners
document.addEventListener('DOMContentLoaded', () =>
{
    checkUrlBtn.addEventListener('click', validateAndFetchVideoInfo);
    addSegmentBtn.addEventListener('click', addSegment);
    extractBtn.addEventListener('click', function (event)
    {
        event.preventDefault();
        extractSegments();
    });
    newExtractionBtn.addEventListener('click', function ()
    {
        window.location.reload();
    });

    // Initialize with one empty segment
    addSegment();
});

// API Functions
async function callAPI(endpoint, method = 'GET', data = null)
{
    try
    {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (data) options.body = JSON.stringify(data);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok)
        {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ein Fehler ist aufgetreten');
        }
        return await response.json();
    } catch (error)
    {
        console.error('API Error:', error);
        showToast('error', `API-Fehler: ${error.message}`);
        throw error;
    }
}

// YouTube URL validation and info fetching
async function validateAndFetchVideoInfo()
{
    const url = videoUrlInput.value.trim();
    if (!url)
    {
        showToast('warning', 'Bitte gib eine YouTube-URL ein');
        return;
    }

    try
    {
        checkUrlBtn.disabled = true;
        checkUrlBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Prüfe...';

        const validateResponse = await callAPI('/validate', 'POST', { url });
        if (!validateResponse.valid)
        {
            showToast('error', 'Ungültige oder nicht verfügbare YouTube-URL');
            resetValidation();
            return;
        }

        currentVideoInfo = await callAPI('/info', 'POST', { url });
        displayVideoInfo(currentVideoInfo);

        qualityCard.style.display = 'block';
        segmentsCard.style.display = 'block';
        extractBtn.disabled = false;

        checkUrlBtn.disabled = false;
        checkUrlBtn.innerHTML = '<i class="fas fa-check me-1"></i> Prüfen';
        showToast('success', 'Video-Informationen erfolgreich geladen');
    } catch (error)
    {
        resetValidation();
    }
}

function resetValidation()
{
    checkUrlBtn.disabled = false;
    checkUrlBtn.innerHTML = '<i class="fas fa-check me-1"></i> Prüfen';
}

function displayVideoInfo(info)
{
    videoThumbnail.src = info.thumbnail;
    videoTitle.textContent = info.title;
    videoUploader.textContent = info.uploader;

    const videoId = getYouTubeId(videoUrlInput.value.trim());
    videoYoutubeLink.href = `https://www.youtube.com/watch?v=${videoId}`;

    const uploadDate = info.upload_date;
    const formattedDate = `${uploadDate.substring(6, 8)}.${uploadDate.substring(4, 6)}.${uploadDate.substring(0, 4)}`;
    videoUploadDate.textContent = formattedDate;

    const durationMin = Math.floor(info.duration / 60);
    const durationSec = info.duration % 60;
    videoDuration.textContent = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

    videoViews.textContent = info.view_count.toLocaleString('de-DE');
    videoInfoCard.style.display = 'block';

    updateSegmentTimeConstraints(info.duration);
}

// Helper function to extract YouTube ID
function getYouTubeId(url)
{
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Segment management
function addSegment()
{
    const segmentIndex = document.querySelectorAll('.segment-item').length;
    const maxDuration = currentVideoInfo ? currentVideoInfo.duration : 600;

    const segmentHtml = `
        <div class="segment-item" data-index="${segmentIndex}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0"><b>Segment ${segmentIndex + 1}</b> <span class="badge bg-secondary segment-duration">Dauer: 10s</span></h6>
                <button class="btn btn-sm btn-outline-danger remove-segment-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="segment-controls">
                <div class="time-input mb-2">
                    <div class="label-container">
                        <label for="start-time-${segmentIndex}" class="time-label">Startzeit</label>
                        <span class="time-display start-time-display">00:00</span>
                    </div>
                    <input type="range" class="form-range start-time" id="start-time-${segmentIndex}" 
                        min="0" max="${maxDuration}" step="1" value="0">
                </div>
                <div class="time-input">
                    <div class="label-container">
                        <label for="end-time-${segmentIndex}" class="time-label">Endzeit</label>
                        <span class="time-display end-time-display">${formatTime(maxDuration > 10 ? 10 : maxDuration)}</span>
                    </div>
                    <input type="range" class="form-range end-time" id="end-time-${segmentIndex}" 
                        min="0" max="${maxDuration}" step="1" value="${maxDuration > 10 ? 10 : maxDuration}">
                </div>
            </div>
        </div>
    `;

    segmentsContainer.insertAdjacentHTML('beforeend', segmentHtml);
    const newSegment = segmentsContainer.lastElementChild;

    newSegment.querySelector('.remove-segment-btn').addEventListener('click', function ()
    {
        removeSegment(newSegment);
    });

    const startTimeInput = newSegment.querySelector('.start-time');
    const endTimeInput = newSegment.querySelector('.end-time');
    const startTimeDisplay = newSegment.querySelector('.start-time-display');
    const endTimeDisplay = newSegment.querySelector('.end-time-display');
    const durationSpan = newSegment.querySelector('.segment-duration');

    startTimeDisplay.textContent = formatTime(parseInt(startTimeInput.value));
    endTimeDisplay.textContent = formatTime(parseInt(endTimeInput.value));
    updateSegmentDuration(parseInt(startTimeInput.value), parseInt(endTimeInput.value), durationSpan);

    startTimeInput.addEventListener('input', () =>
    {
        let start = parseInt(startTimeInput.value);
        let end = parseInt(endTimeInput.value);
        const minDuration = 1;
        if (end - start < minDuration)
        {
            end = start + minDuration;
            if (end > maxDuration)
            {
                end = maxDuration;
                start = end - minDuration;
                startTimeInput.value = start;
            }
            endTimeInput.value = end;
        }
        startTimeDisplay.textContent = formatTime(start);
        endTimeDisplay.textContent = formatTime(end);
        updateSegmentDuration(start, end, durationSpan);
    });

    endTimeInput.addEventListener('input', () =>
    {
        let start = parseInt(startTimeInput.value);
        let end = parseInt(endTimeInput.value);
        const minDuration = 1;
        if (end - start < minDuration)
        {
            start = end - minDuration;
            if (start < 0)
            {
                start = 0;
                end = minDuration;
                endTimeInput.value = end;
            }
            startTimeInput.value = start;
        }
        startTimeDisplay.textContent = formatTime(start);
        endTimeDisplay.textContent = formatTime(end);
        updateSegmentDuration(start, end, durationSpan);
    });

    updateExtractButtonState();
}

function removeSegment(segmentElement)
{
    segmentElement.remove();
    const segments = document.querySelectorAll('.segment-item');
    segments.forEach((segment, index) =>
    {
        segment.setAttribute('data-index', index);
        const h6 = segment.querySelector('h6');
        h6.innerHTML = `Segment ${index + 1} <span class="badge bg-secondary segment-duration">${segment.querySelector('.segment-duration').textContent}</span>`;
    });
    updateExtractButtonState();
}

function updateSegmentTimeConstraints(maxDuration)
{
    const segments = document.querySelectorAll('.segment-item');
    segments.forEach(segment =>
    {
        const startTimeInput = segment.querySelector('.start-time');
        const endTimeInput = segment.querySelector('.end-time');
        const startTimeDisplay = segment.querySelector('.start-time-display');
        const endTimeDisplay = segment.querySelector('.end-time-display');
        const durationSpan = segment.querySelector('.segment-duration');

        startTimeInput.max = maxDuration - 1;
        endTimeInput.max = maxDuration;

        let start = parseInt(startTimeInput.value);
        let end = parseInt(endTimeInput.value);
        if (start > maxDuration - 1) start = maxDuration - 1;
        if (end > maxDuration) end = maxDuration;
        if (end - start < 1) end = start + 1;

        startTimeInput.value = start;
        endTimeInput.value = end;
        startTimeDisplay.textContent = formatTime(start);
        endTimeDisplay.textContent = formatTime(end);
        updateSegmentDuration(start, end, durationSpan);
    });
}

function updateSegmentDuration(start, end, durationSpan)
{
    const duration = end - start;
    durationSpan.textContent = `Dauer: ${duration}s`;
}

function updateExtractButtonState()
{
    const segments = document.querySelectorAll('.segment-item');
    extractBtn.disabled = segments.length === 0 || !currentVideoInfo;
}

// Extraction process
async function extractSegments()
{
    const segmentElements = document.querySelectorAll('.segment-item');
    if (segmentElements.length === 0)
    {
        showToast('warning', 'Füge mindestens ein Segment hinzu');
        return;
    }

    const segments = [];
    let hasErrors = false;

    segmentElements.forEach(segmentElement =>
    {
        const startTime = parseInt(segmentElement.querySelector('.start-time').value);
        const endTime = parseInt(segmentElement.querySelector('.end-time').value);
        if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime)
        {
            hasErrors = true;
            return;
        }
        segments.push({ start: startTime, end: endTime });
    });

    if (hasErrors)
    {
        showToast('error', 'Ungültige Zeitangaben in einem oder mehreren Segmenten');
        return;
    }

    currentSegments = segments;
    completedSegments = [];

    enterExtractionMode();
    updateSegmentsToLoadingState();

    try
    {
        const extractResponse = await callAPI('/extract', 'POST', {
            url: videoUrlInput.value.trim(),
            segments: segments,
            quality: qualitySelect.value
        });
        currentJobId = extractResponse.jobId;
        startStatusPolling(currentJobId);
    } catch (error)
    {
        showToast('error', `Fehler beim Starten der Extraktion: ${error.message}`);
        exitExtractionMode();
    }
}

function enterExtractionMode()
{
    urlCard.style.display = 'none';
    segmentsHeader.style.display = 'none';
    addSegmentBtn.style.display = 'none';
    extractBtnContainer.style.display = 'none';
    qualitySelect.disabled = true;
    document.querySelectorAll('.remove-segment-btn').forEach(btn => btn.style.display = 'none');
    document.querySelectorAll('.start-time, .end-time').forEach(input => input.disabled = true);
}

function exitExtractionMode()
{
    urlCard.style.display = 'block';
    segmentsHeader.style.display = 'flex';
    addSegmentBtn.style.display = 'block';
    extractBtnContainer.style.display = 'block';
    qualitySelect.disabled = false;
    document.querySelectorAll('.remove-segment-btn').forEach(btn => btn.style.display = 'block');
    document.querySelectorAll('.start-time, .end-time').forEach(input => input.disabled = false);
}

function updateSegmentsToLoadingState()
{
    segmentsContainer.innerHTML = '';
    currentSegments.forEach((segment, index) =>
    {
        const duration = segment.end - segment.start;
        const loadingSegmentHtml = `
            <div class="segment-item segment-loading" data-index="${index}">
                <div class="spinner-container">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Lädt...</span>
                    </div>
                    <p class="spinner-text mb-0">Segment ${index + 1} wird extrahiert...</p>
                    <div class="mt-2">
                        <small class="text-muted">
                            Startzeit: ${formatTime(segment.start)} | 
                            Endzeit: ${formatTime(segment.end)} | 
                            Dauer: ${duration}s
                        </small>
                    </div>
                </div>
            </div>
        `;
        segmentsContainer.insertAdjacentHTML('beforeend', loadingSegmentHtml);
    });
}

function updateSegmentToReadyState(index, filePath)
{
    const segment = currentSegments[index];
    const duration = segment.end - segment.start;
    const segmentElement = document.querySelector(`.segment-item[data-index="${index}"]`);
    if (segmentElement)
    {
        segmentElement.className = 'segment-item segment-ready';
        segmentElement.innerHTML = `
            <div class="segment-info">
                <h6 class="mb-1">Segment ${index + 1}</h6>
                <p class="mb-0 text-muted">
                    Startzeit: ${formatTime(segment.start)} | 
                    Endzeit: ${formatTime(segment.end)} | 
                    Dauer: ${duration}s
                </p>
            </div>
            <div class="segment-actions">
                <button class="btn-video play-btn" data-index="${index}">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `;
        segmentElement.querySelector('.play-btn').addEventListener('click', function ()
        {
            playVideo(index);
        });
    }
}

function startStatusPolling(jobId)
{
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    statusCheckInterval = setInterval(async () =>
    {
        try
        {
            const status = await callAPI(`/status/${jobId}`);
            if (status.status === 'completed')
            {
                handleCompletedJob(status);
            } else if (status.status === 'failed')
            {
                clearInterval(statusCheckInterval);
                showToast('error', `Extraktion fehlgeschlagen: ${status.error || 'Unbekannter Fehler'}`);
                exitExtractionMode();
            } else if (status.result && Array.isArray(status.result))
            {
                updateCompletedSegments(status.result);
            }
        } catch (error)
        {
            console.error('Status check error:', error);
        }
    }, 2000);
}

function updateCompletedSegments(results)
{
    if (!results) return;
    results.forEach((result, index) =>
    {
        if (!completedSegments.includes(index))
        {
            completedSegments.push(index);
            updateSegmentToReadyState(index, result.filePath);
        }
    });
}

function handleCompletedJob(status)
{
    clearInterval(statusCheckInterval);
    if (status.result && Array.isArray(status.result)) updateCompletedSegments(status.result);
    newExtractionContainer.style.display = 'block';
    showToast('success', 'Alle Segmente wurden erfolgreich extrahiert');
}

function playVideo(index)
{
    const streamUrl = `${API_BASE_URL}/stream/${currentJobId}/${index}`;
    const downloadUrl = `${API_BASE_URL}/download/${currentJobId}/${index}`;
    videoPlayer.src = streamUrl;
    videoDownloadBtn.href = downloadUrl;

    const videoModalEl = document.getElementById('videoPlayerModal');
    const videoModal = new bootstrap.Modal(videoModalEl);
    videoModal.show();

    const segment = currentSegments[index];
    document.getElementById('videoPlayerModalLabel').textContent =
        `Segment ${index + 1}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`;

    videoModalEl.addEventListener('shown.bs.modal', function ()
    {
        videoPlayer.play().catch(error => console.error('Video playback error:', error));
    });
    videoModalEl.addEventListener('hidden.bs.modal', function ()
    {
        videoPlayer.pause();
    });
}

function formatTime(seconds)
{
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Utility functions
function showToast(type, message)
{
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${getToastBackground(type)} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas ${getToastIcon(type)} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer)
    {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', function ()
    {
        toast.remove();
    });
}

function getToastBackground(type)
{
    switch (type)
    {
        case 'success': return 'success';
        case 'error': return 'danger';
        case 'warning': return 'warning';
        case 'info': return 'info';
        default: return 'primary';
    }
}

function getToastIcon(type)
{
    switch (type)
    {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-info-circle';
    }
}