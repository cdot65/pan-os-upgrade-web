{{/*
Expand the name of the chart.
*/}}
{{- define "pan-os-upgrade-web.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "pan-os-upgrade-web.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "pan-os-upgrade-web.labels" -}}
helm.sh/chart: {{ include "pan-os-upgrade-web.chart" . }}
{{ include "pan-os-upgrade-web.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "pan-os-upgrade-web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pan-os-upgrade-web.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}