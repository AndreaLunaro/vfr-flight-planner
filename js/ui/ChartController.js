export class ChartController {
    constructor() {
        this.chart = null;
    }

    initialize(canvasId, aircraft, envelope) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'W&B Envelope',
                    data: envelope,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    showLine: true,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#1FB8CD'
                }, {
                    label: 'Aircraft Position',
                    data: [],
                    backgroundColor: '#DB4545',
                    borderColor: '#DB4545',
                    pointRadius: 8,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: aircraft.xLabel
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: aircraft.yLabel
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }

    update(envelope, point, aircraft) {
        if (!this.chart) return;

        this.chart.options.scales.x.title.text = aircraft.xLabel;
        this.chart.options.scales.y.title.text = aircraft.yLabel;
        this.chart.data.datasets[0].data = envelope;

        if (point) {
            this.chart.data.datasets[1].data = [point];
        } else {
            this.chart.data.datasets[1].data = [];
        }

        this.chart.update();
    }
}
