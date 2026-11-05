{{/*
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/}}
{{- define "blackbox-probes.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "blackbox-probes.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "blackbox-probes.labels" -}}
app.kubernetes.io/name: {{ include "blackbox-probes.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: blackbox-probes
{{- end -}}

{{- define "blackbox-probes.selectorLabels" -}}
app.kubernetes.io/name: {{ include "blackbox-probes.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
