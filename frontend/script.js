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
    // Initialize event listeners
    checkUrlBtn.addEventListener('click', validateAndFetchVideoInfo);
    addSegmentBtn.addEventListener('click', addSegment);
    extractBtn.addEventListener('click', function (event)
    {
        event.preventDefault();  // Prevent form submission
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

        if (data)
        {
            options.body = JSON.stringify(data);
        }

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
        // Disable input during validation
        checkUrlBtn.disabled = true;
        checkUrlBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Prüfe...';

        // Validate URL
        const validateResponse = await callAPI('/validate', 'POST', { url });

        if (!validateResponse.valid)
        {
            showToast('error', 'Ungültige oder nicht verfügbare YouTube-URL');
            resetValidation();
            return;
        }

        // Fetch video info
        currentVideoInfo = await callAPI('/info', 'POST', { url });

        // Display video info
        displayVideoInfo(currentVideoInfo);

        // Enable segments section and quality selection
        qualityCard.style.display = 'block';
        segmentsCard.style.display = 'block';
        extractBtn.disabled = false;

        // Update UI state
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
    // Update video information elements
    videoThumbnail.src = info.thumbnail;
    videoTitle.textContent = info.title;
    videoUploader.textContent = info.uploader;

    // Set YouTube link
    const videoId = getYouTubeId(videoUrlInput.value.trim());
    videoYoutubeLink.href = `https://www.youtube.com/watch?v=${videoId}`;

    // Format upload date (YYYYMMDD to DD.MM.YYYY)
    const uploadDate = info.upload_date;
    const formattedDate = `${uploadDate.substring(6, 8)}.${uploadDate.substring(4, 6)}.${uploadDate.substring(0, 4)}`;
    videoUploadDate.textContent = formattedDate;

    // Format duration (seconds to MM:SS)
    const durationMin = Math.floor(info.duration / 60);
    const durationSec = info.duration % 60;
    videoDuration.textContent = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

    // Format view count with thousands separator
    videoViews.textContent = info.view_count.toLocaleString('de-DE');

    // Show video info card
    videoInfoCard.style.display = 'block';

    // Reset all segments to have the max duration of the video
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
    const maxDuration = currentVideoInfo ? currentVideoInfo.duration : 0;

    const segmentHtml = `
        <div class="segment-item" data-index="${segmentIndex}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0">Segment ${segmentIndex + 1}</h6>
                <button class="btn btn-sm btn-outline-danger remove-segment-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="segment-controls">
                <div class="time-input-group">
                    <div class="time-input">
                        <label for="start-time-${segmentIndex}" class="form-label">Startzeit (s)</label>
                        <input type="number" class="form-control start-time" id="start-time-${segmentIndex}" 
                               min="0" max="${maxDuration}" value="0" step="1" required>
                    </div>
                    <div class="time-input">
                        <label for="end-time-${segmentIndex}" class="form-label">Endzeit (s)</label>
                        <input type="number" class="form-control end-time" id="end-time-${segmentIndex}" 
                               min="1" max="${maxDuration}" value="${maxDuration > 10 ? 10 : maxDuration}" step="1" required>
                    </div>
                </div>
                <div class="d-flex align-items-end">
                    <span class="badge bg-secondary ms-2">Dauer: <span class="segment-duration">10s</span></span>
                </div>
            </div>
        </div>
    `;

    segmentsContainer.insertAdjacentHTML('beforeend', segmentHtml);

    // Add event listeners to new segment
    const newSegment = segmentsContainer.lastElementChild;

    // Remove button
    newSegment.querySelector('.remove-segment-btn').addEventListener('click', function ()
    {
        removeSegment(newSegment);
    });

    // Time inputs
    const startTimeInput = newSegment.querySelector('.start-time');
    const endTimeInput = newSegment.querySelector('.end-time');
    const durationSpan = newSegment.querySelector('.segment-duration');

    // Update duration display on change
    startTimeInput.addEventListener('input', () =>
    {
        updateSegmentDuration(startTimeInput, endTimeInput, durationSpan);
    });

    endTimeInput.addEventListener('input', () =>
    {
        updateSegmentDuration(startTimeInput, endTimeInput, durationSpan);
    });

    // Ensure extract button is enabled only if there's at least one segment
    updateExtractButtonState();
}

function removeSegment(segmentElement)
{
    segmentElement.remove();

    // Renumber remaining segments
    const segments = document.querySelectorAll('.segment-item');
    segments.forEach((segment, index) =>
    {
        segment.setAttribute('data-index', index);
        segment.querySelector('h6').textContent = `Segment ${index + 1}`;
    });

    // Update extract button state
    updateExtractButtonState();
}

function updateSegmentTimeConstraints(maxDuration)
{
    const segments = document.querySelectorAll('.segment-item');

    segments.forEach(segment =>
    {
        const startTimeInput = segment.querySelector('.start-time');
        const endTimeInput = segment.querySelector('.end-time');

        startTimeInput.max = maxDuration - 1;
        endTimeInput.max = maxDuration;

        // Update end time if it exceeds max duration
        if (parseInt(endTimeInput.value) > maxDuration)
        {
            endTimeInput.value = maxDuration;
        }

        // Update duration display
        const durationSpan = segment.querySelector('.segment-duration');
        updateSegmentDuration(startTimeInput, endTimeInput, durationSpan);
    });
}

function updateSegmentDuration(startTimeInput, endTimeInput, durationSpan)
{
    const startTime = parseInt(startTimeInput.value) || 0;
    const endTime = parseInt(endTimeInput.value) || 0;

    // Validate: end time must be greater than start time
    if (endTime <= startTime)
    {
        endTimeInput.value = startTime + 1;
    }

    // Update duration display
    const duration = parseInt(endTimeInput.value) - parseInt(startTimeInput.value);
    durationSpan.textContent = `${duration}s`;
}

function updateExtractButtonState()
{
    const segments = document.querySelectorAll('.segment-item');
    extractBtn.disabled = segments.length === 0 || !currentVideoInfo;
}

// Extraction process
async function extractSegments()
{
    try
    {
        // Validate if we have segments
        const segmentElements = document.querySelectorAll('.segment-item');
        if (segmentElements.length === 0)
        {
            showToast('warning', 'Füge mindestens ein Segment hinzu');
            return;
        }

        // Collect segment data
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

            segments.push({
                start: startTime,
                end: endTime
            });
        });

        if (hasErrors)
        {
            showToast('error', 'Ungültige Zeitangaben in einem oder mehreren Segmenten');
            return;
        }

        // Save current segments for reference
        currentSegments = segments;
        completedSegments = [];

        // Update UI to extraction mode
        enterExtractionMode();

        // Replace segment UI with loading indicators
        updateSegmentsToLoadingState();

        // Start extraction
        const extractResponse = await callAPI('/extract', 'POST', {
            url: videoUrlInput.value.trim(),
            segments: segments,
            quality: qualitySelect.value
        });

        currentJobId = extractResponse.jobId;

        // Start polling for status
        startStatusPolling(currentJobId);
    } catch (error)
    {
        showToast('error', `Fehler beim Starten der Extraktion: ${error.message}`);
        exitExtractionMode();
    }
}

function enterExtractionMode()
{
    // Hide URL card
    urlCard.style.display = 'none';

    // Hide segment controls
    segmentsHeader.style.display = 'none';
    addSegmentBtn.style.display = 'none';
    extractBtnContainer.style.display = 'none';

    // Disable quality selection
    qualitySelect.disabled = true;

    // Remove segment removal buttons
    document.querySelectorAll('.remove-segment-btn').forEach(btn =>
    {
        btn.style.display = 'none';
    });

    // Disable time inputs
    document.querySelectorAll('.start-time, .end-time').forEach(input =>
    {
        input.disabled = true;
    });
}

function exitExtractionMode()
{
    // Show URL card
    urlCard.style.display = 'block';

    // Show segment controls
    segmentsHeader.style.display = 'flex';
    addSegmentBtn.style.display = 'block';
    extractBtnContainer.style.display = 'block';

    // Enable quality selection
    qualitySelect.disabled = false;

    // Show segment removal buttons
    document.querySelectorAll('.remove-segment-btn').forEach(btn =>
    {
        btn.style.display = 'block';
    });

    // Enable time inputs
    document.querySelectorAll('.start-time, .end-time').forEach(input =>
    {
        input.disabled = false;
    });
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

    // Find the segment element
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

        // Add event listener to play button
        segmentElement.querySelector('.play-btn').addEventListener('click', function ()
        {
            playVideo(index);
        });
    }
}

function startStatusPolling(jobId)
{
    // Clear any existing interval
    if (statusCheckInterval)
    {
        clearInterval(statusCheckInterval);
    }

    // Poll every 2 seconds
    statusCheckInterval = setInterval(async () =>
    {
        try
        {
            const status = await callAPI(`/status/${jobId}`);

            // Check if complete or failed
            if (status.status === 'completed')
            {
                // Update UI for completed job
                handleCompletedJob(status);
            } else if (status.status === 'failed')
            {
                clearInterval(statusCheckInterval);
                showToast('error', `Extraktion fehlgeschlagen: ${status.error || 'Unbekannter Fehler'}`);
                exitExtractionMode();
            } else
            {
                // For pending jobs, check if any results are already available
                if (status.result && Array.isArray(status.result))
                {
                    updateCompletedSegments(status.result);
                }
            }
        } catch (error)
        {
            console.error('Status check error:', error);
            // Continue polling even if there's an error
        }
    }, 2000);
}

function updateCompletedSegments(results)
{
    if (!results) return;

    results.forEach((result, index) =>
    {
        // Check if this segment has already been processed
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

    // Update all segments to ready state
    if (status.result && Array.isArray(status.result))
    {
        updateCompletedSegments(status.result);
    }

    // Show the "New Extraction" button
    newExtractionContainer.style.display = 'block';

    showToast('success', 'Alle Segmente wurden erfolgreich extrahiert');
}

function playVideo(index)
{
    // Use streaming endpoint for playing in browser
    const streamUrl = `${API_BASE_URL}/stream/${currentJobId}/${index}`;
    const downloadUrl = `${API_BASE_URL}/download/${currentJobId}/${index}`;

    // Set video source
    videoPlayer.src = streamUrl;

    // Set download link
    videoDownloadBtn.href = downloadUrl;

    // Show modal with video
    const videoModalEl = document.getElementById('videoPlayerModal');
    const videoModal = new bootstrap.Modal(videoModalEl);
    videoModal.show();

    // Update modal title with segment info
    const segment = currentSegments[index];
    document.getElementById('videoPlayerModalLabel').textContent =
        `Segment ${index + 1}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`;

    // Play video when modal is shown
    videoModalEl.addEventListener('shown.bs.modal', function ()
    {
        videoPlayer.play().catch(error =>
        {
            console.error('Video playback error:', error);
        });
    });

    // Pause video when modal is hidden
    videoModalEl.addEventListener('hidden.bs.modal', function ()
    {
        videoPlayer.pause();
    });
}

function formatTime(seconds)
{
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Utility functions
function showToast(type, message)
{
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${getToastBackground(type)} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    // Toast content
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas ${getToastIcon(type)} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    // Add to container (create if doesn't exist)
    let toastContainer = document.querySelector('.toast-container');

    if (!toastContainer)
    {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    toastContainer.appendChild(toast);

    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();

    // Remove from DOM after hidden
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