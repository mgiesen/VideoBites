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
const mergeSegmentsCheck = document.getElementById('mergeSegmentsCheck');
const parallelExtractionCheck = document.getElementById('parallelExtractionCheck');
const segmentsCard = document.getElementById('segmentsCard');
const segmentsHeader = document.getElementById('segmentsHeader');
const addSegmentBtn = document.getElementById('addSegmentBtn');
const segmentsContainer = document.getElementById('segmentsContainer');
const extractBtnContainer = document.getElementById('extractBtnContainer');
const extractBtn = document.getElementById('extractBtn');
const mergedSegmentCard = document.getElementById('mergedSegmentCard');
const mergedSegmentContainer = document.getElementById('mergedSegmentContainer');
const newExtractionContainer = document.getElementById('newExtractionContainer');
const newExtractionBtn = document.getElementById('newExtractionBtn');
const videoPlayerModal = document.getElementById('videoPlayerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoDownloadBtn = document.getElementById('videoDownloadBtn');

// Event listeners
document.addEventListener('DOMContentLoaded', () =>
{
    checkUrlBtn.addEventListener('click', validateAndFetchVideoInfo);

    addSegmentBtn.addEventListener('click', function ()
    {
        addSegment(false);
    });

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
    addSegment(true);
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
function addSegment(isFirstElement = false)
{
    const segmentIndex = document.querySelectorAll('.segment-item').length;
    const maxDuration = currentVideoInfo ? currentVideoInfo.duration : 600;
    const deleteIcon = !isFirstElement ? '<button type="button" class="btn btn-sm btn-light remove-segment-btn" aria-label="Delete"><i class="fas fa-trash-alt"></i></button>' : '';

    const segmentHtml = `
        <div class="segment-item" data-index="${segmentIndex}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0"><b>Segment ${segmentIndex + 1}</b> <span class="badge bg-secondary segment-duration">Dauer: 10s</span></h6>
                ${deleteIcon}
            </div>
            <div class="segment-controls">
                <div class="time-input mb-3">
                    <label for="start-time-${segmentIndex}" class="time-label mb-1">Startzeit</label>
                    <div class="d-flex align-items-center mb-1">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn me-2" data-action="decrease-start">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="text" class="form-control time-text-input start-time-text" style="text-align: center;" placeholder="00:00" value="00:00">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn ms-2" data-action="increase-start">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <input type="range" class="form-range start-time" id="start-time-${segmentIndex}" 
                        min="0" max="${maxDuration}" step="1" value="0">
                </div>
                <div class="time-input">
                    <label for="end-time-${segmentIndex}" class="time-label mb-1">Endzeit</label>
                    <div class="d-flex align-items-center mb-1">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn me-2" data-action="decrease-end">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="text" class="form-control time-text-input end-time-text" style="text-align: center;" placeholder="00:10" value="${formatTime(maxDuration > 10 ? 10 : maxDuration)}">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn ms-2" data-action="increase-end">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <input type="range" class="form-range end-time" id="end-time-${segmentIndex}" 
                        min="0" max="${maxDuration}" step="1" value="${maxDuration > 10 ? 10 : maxDuration}">
                </div>
            </div>
        </div>
    `;

    segmentsContainer.insertAdjacentHTML('beforeend', segmentHtml);
    const newSegment = segmentsContainer.lastElementChild;

    const removeBtn = newSegment.querySelector('.remove-segment-btn');
    if (removeBtn)
    {
        removeBtn.addEventListener('click', function ()
        {
            removeSegment(newSegment);
        });
    }

    const startTimeInput = newSegment.querySelector('.start-time');
    const endTimeInput = newSegment.querySelector('.end-time');
    const startTimeTextInput = newSegment.querySelector('.start-time-text');
    const endTimeTextInput = newSegment.querySelector('.end-time-text');
    const durationSpan = newSegment.querySelector('.segment-duration');

    updateSegmentDuration(parseInt(startTimeInput.value), parseInt(endTimeInput.value), durationSpan);

    function parseTimeInput(timeStr)
    {
        const parts = timeStr.split(':').map(part => parseInt(part) || 0);
        if (parts.length === 3)
        {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2)
        {
            return parts[0] * 60 + parts[1];
        }
        return 0;
    }

    function updateTimeUI(start, end)
    {
        startTimeInput.value = start;
        endTimeInput.value = end;
        startTimeTextInput.value = formatTime(start);
        endTimeTextInput.value = formatTime(end);
        updateSegmentDuration(start, end, durationSpan);
    }

    function handleTimeChange(newStart, newEnd)
    {
        const maxDuration = parseInt(endTimeInput.max);
        const minDuration = 1;
        newStart = Math.max(0, Math.min(newStart, maxDuration - minDuration));
        newEnd = Math.max(newStart + minDuration, Math.min(newEnd, maxDuration));
        updateTimeUI(newStart, newEnd);
    }

    startTimeInput.addEventListener('input', () =>
    {
        let start = parseInt(startTimeInput.value);
        let end = parseInt(endTimeInput.value);
        const minDuration = 1;
        const maxDuration = parseInt(endTimeInput.max);

        if (start > end - minDuration)
        {
            end = Math.min(start + minDuration, maxDuration);
        }

        updateTimeUI(start, end);
    });

    endTimeInput.addEventListener('input', () =>
    {
        let start = parseInt(startTimeInput.value);
        let end = parseInt(endTimeInput.value);
        const minDuration = 1;

        if (end < minDuration)
        {
            end = minDuration;
        }

        if (end < start + minDuration)
        {
            start = Math.max(end - minDuration, 0);
        }

        updateTimeUI(start, end);
    });

    startTimeTextInput.addEventListener('change', () =>
    {
        const inputTime = parseTimeInput(startTimeTextInput.value);
        const currentEnd = parseInt(endTimeInput.value);
        handleTimeChange(inputTime, currentEnd);
    });

    endTimeTextInput.addEventListener('change', () =>
    {
        const currentStart = parseInt(startTimeInput.value);
        const inputTime = parseTimeInput(endTimeTextInput.value);
        handleTimeChange(currentStart, inputTime);
    });

    const decreaseStartBtn = newSegment.querySelector('[data-action="decrease-start"]');
    const increaseStartBtn = newSegment.querySelector('[data-action="increase-start"]');
    const decreaseEndBtn = newSegment.querySelector('[data-action="decrease-end"]');
    const increaseEndBtn = newSegment.querySelector('[data-action="increase-end"]');

    decreaseStartBtn.addEventListener('click', () =>
    {
        const start = parseInt(startTimeInput.value) - 1;
        const end = parseInt(endTimeInput.value);
        handleTimeChange(start, end);
    });

    increaseStartBtn.addEventListener('click', () =>
    {
        const start = parseInt(startTimeInput.value) + 1;
        const end = parseInt(endTimeInput.value);
        handleTimeChange(start, end);
    });

    decreaseEndBtn.addEventListener('click', () =>
    {
        const start = parseInt(startTimeInput.value);
        const end = parseInt(endTimeInput.value) - 1;
        handleTimeChange(start, end);
    });

    increaseEndBtn.addEventListener('click', () =>
    {
        const start = parseInt(startTimeInput.value);
        const end = parseInt(endTimeInput.value) + 1;
        handleTimeChange(start, end);
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
        segment.querySelector('h6').innerHTML = `<b>Segment ${index + 1}</b> <span class="badge bg-secondary segment-duration">${segment.querySelector('.segment-duration').textContent}</span>`;
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
        const startTimeTextInput = segment.querySelector('.start-time-text');
        const endTimeTextInput = segment.querySelector('.end-time-text');
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
        startTimeTextInput.value = formatTime(start);
        endTimeTextInput.value = formatTime(end);
        updateSegmentDuration(start, end, durationSpan);
    });
}

function formatDuration(seconds)
{
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0)
    {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else
    {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

function updateSegmentDuration(start, end, durationSpan)
{
    const duration = end - start;
    durationSpan.textContent = `Dauer: ${formatDuration(duration)}`;
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
            quality: qualitySelect.value,
            mergeSegments: mergeSegmentsCheck.checked,
            parallelExtraction: parallelExtractionCheck.checked
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
    qualityCard.style.display = 'none';

    segmentsHeader.style.display = 'none';
    addSegmentBtn.style.display = 'none';
    extractBtnContainer.style.display = 'none';

    document.querySelectorAll('.remove-segment-btn').forEach(btn => btn.style.display = 'none');
    document.querySelectorAll('.start-time, .end-time, .time-text-input, .time-stepper-btn').forEach(input => input.disabled = true);
}

function exitExtractionMode()
{
    urlCard.style.display = 'block';
    qualityCard.style.display = 'block';

    segmentsHeader.style.display = 'flex';
    addSegmentBtn.style.display = 'block';
    extractBtnContainer.style.display = 'block';

    document.querySelectorAll('.remove-segment-btn').forEach(btn => btn.style.display = 'block');
    document.querySelectorAll('.start-time, .end-time, .time-text-input, .time-stepper-btn').forEach(input => input.disabled = false);
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
                            Dauer: ${formatDuration(duration)}
                        </small>
                    </div>
                </div>
            </div>
        `;
        segmentsContainer.insertAdjacentHTML('beforeend', loadingSegmentHtml);
    });

    const docSegmentHtml = `
        <div class="segment-item segment-loading" id="documentation-segment">
            <div class="spinner-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Lädt...</span>
                </div>
                <p class="spinner-text mb-0">Quellendokumentation wird erstellt...</p>
                <div class="mt-2">
                    <small class="text-muted">
                        Metadaten und Segmentinformationen
                    </small>
                </div>
            </div>
        </div>
    `;
    segmentsContainer.insertAdjacentHTML('beforeend', docSegmentHtml);

    if (mergeSegmentsCheck.checked && currentSegments.length > 1)
    {
        const totalDuration = currentSegments.reduce((total, segment) => total + (segment.end - segment.start), 0);
        mergedSegmentCard.style.display = 'block';
        mergedSegmentContainer.innerHTML = `
            <div class="segment-item segment-loading segment-merged" data-merged="true">
                <div class="spinner-container">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Lädt...</span>
                    </div>
                    <p class="spinner-text mb-0">Zusammenschnitt wird erstellt...</p>
                    <div class="mt-2">
                        <small class="text-muted">
                            Gesamtdauer: ${formatDuration(totalDuration)} | 
                            Segmente: ${currentSegments.length}
                        </small>
                    </div>
                </div>
            </div>
        `;
    }
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
                    Dauer: ${formatDuration(duration)}
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

function updateMergedSegmentToReadyState(result)
{
    const segment = result.segment;
    const duration = segment.end - segment.start;

    mergedSegmentContainer.innerHTML = `
        <div class="segment-item segment-ready segment-merged" data-merged="true">
            <div class="segment-info">
                <h6 class="mb-1">Zusammenschnitt aller Segmente</h6>
                <p class="mb-0 text-muted">
                    Gesamtdauer: ${formatDuration(duration)} | 
                    Segmente: ${currentSegments.length}
                </p>
            </div>
            <div class="segment-actions">
                <button class="btn-video play-btn" data-merged="true">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        </div>
    `;

    mergedSegmentContainer.querySelector('.play-btn').addEventListener('click', function ()
    {
        playVideo(currentSegments.length);
    });
}

function updateDocumentationToReadyState()
{
    const docElement = document.getElementById('documentation-segment');
    if (docElement)
    {
        // Klasse zu "segment-ready" geändert (entfernt segment-documentation)
        docElement.className = 'segment-item segment-ready';
        docElement.innerHTML = `
            <div class="segment-info">
                <h6 class="mb-1">Quellendokumentation</h6>
                <p class="mb-0 text-muted">
                    Metadaten und Segmentinformationen
                </p>
            </div>
            <div class="segment-actions">
                <button class="btn-video download-btn" id="downloadDocBtn">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;

        document.getElementById('downloadDocBtn').addEventListener('click', function ()
        {
            downloadDocumentation();
        });
    }
}

async function downloadDocumentation()
{
    try
    {
        const response = await fetch(`${API_BASE_URL}/documentation/${currentJobId}`);
        if (!response.ok)
        {
            throw new Error('Dokumentation konnte nicht abgerufen werden');
        }

        const documentation = await response.json();
        const blob = new Blob([JSON.stringify(documentation, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `videobites_dokumentation_${documentation.videoInfo.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('success', 'Dokumentation heruntergeladen');
    } catch (error)
    {
        console.error('Fehler beim Herunterladen der Dokumentation:', error);
        showToast('error', 'Fehler beim Herunterladen der Dokumentation');
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
        // Nur Segmente mit einer fertigen Datei aktualisieren
        if (result.filePath)
        {
            if (result.segment && result.segment.isMerged)
            {
                updateMergedSegmentToReadyState(result);
                // Speichern für den Download/Stream-Index
                completedSegments.push({ index: currentSegments.length, type: result.type });
            }
            else if (!completedSegments.some(seg => seg.index === index))
            {
                completedSegments.push({ index, type: result.type });
                updateSegmentToReadyState(index, result.filePath);
            }
        }
    });
}

function handleCompletedJob(status)
{
    clearInterval(statusCheckInterval);
    if (status.result && Array.isArray(status.result)) updateCompletedSegments(status.result);

    // Prüfen, ob Dokumentation verfügbar ist
    if (status.documentation)
    {
        updateDocumentationToReadyState();
    }

    newExtractionContainer.style.display = 'block';
    showToast('success', 'Alle Segmente wurden erfolgreich extrahiert');
}

function playVideo(index)
{
    const segmentInfo = completedSegments.find(seg => seg.index === index);
    if (!segmentInfo) return;

    const isAudio = segmentInfo.type === "audio";
    const streamUrl = `${API_BASE_URL}/stream/${currentJobId}/${index}`;
    const downloadUrl = `${API_BASE_URL}/download/${currentJobId}/${index}`;

    const videoModalEl = document.getElementById("videoPlayerModal");
    const videoModal = new bootstrap.Modal(videoModalEl);

    const videoPlayer = document.getElementById("videoPlayer");

    if (isAudio)
    {
        videoPlayer.src = "";
        videoPlayer.style.display = "none";

        let audioPlayer = document.getElementById("audioPlayer");
        if (!audioPlayer)
        {
            audioPlayer = document.createElement("audio");
            audioPlayer.id = "audioPlayer";
            audioPlayer.controls = true;
            audioPlayer.className = "w-100";
            videoModalEl.querySelector(".modal-body").appendChild(audioPlayer);
        }
        else
        {
            audioPlayer.style.display = "block";
        }
        audioPlayer.src = streamUrl;

        videoDownloadBtn.href = downloadUrl;
        videoModal.show();

        const isMerged = index === currentSegments.length;
        if (!isMerged)
        {
            const segment = currentSegments[index];
            document.getElementById("videoPlayerModalLabel").textContent =
                `Audio-Segment ${index + 1}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
        }
        else
        {
            document.getElementById("videoPlayerModalLabel").textContent =
                "Zusammenschnitt aller Audio-Segmente";
        }

        videoModalEl.addEventListener("shown.bs.modal", function ()
        {
            audioPlayer.play().catch(error => console.error("Audio playback error:", error));
        });
        videoModalEl.addEventListener("hidden.bs.modal", function ()
        {
            audioPlayer.pause();
        });
    }
    else
    {
        videoPlayer.src = streamUrl;
        videoPlayer.style.display = "block";

        const audioPlayer = document.getElementById("audioPlayer");
        if (audioPlayer) audioPlayer.style.display = "none";

        videoDownloadBtn.href = downloadUrl;
        videoModal.show();

        const isMerged = index === currentSegments.length;
        if (!isMerged)
        {
            const segment = currentSegments[index];
            document.getElementById("videoPlayerModalLabel").textContent =
                `Segment ${index + 1}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
        }
        else
        {
            document.getElementById("videoPlayerModalLabel").textContent =
                "Zusammenschnitt aller Segmente";
        }

        videoModalEl.addEventListener("shown.bs.modal", function ()
        {
            videoPlayer.play().catch(error => console.error("Video playback error:", error));
        });
        videoModalEl.addEventListener("hidden.bs.modal", function ()
        {
            videoPlayer.pause();
        });
    }
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