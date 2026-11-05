{{/*
SPDX-FileCopyrightText: 2026 openEduSuite Contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/}}
{{- define "opentelemetry-collector.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "opentelemetry-collector.fullname" -}}
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

{{- define "opentelemetry-collector.labels" -}}
app.kubernetes.io/name: {{ include "opentelemetry-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: tracing
app.kubernetes.io/part-of: observability
{{- end -}}

{{- define "opentelemetry-collector.selectorLabels" -}}
app.kubernetes.io/name: {{ include "opentelemetry-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
